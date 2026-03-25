"""检查 API 集成测试"""
import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime
from typing import AsyncGenerator

from app.main import app
from app.database import get_db
from app.models import CheckResult, CheckResultDetail


@pytest.fixture
async def test_check_result(db_session, test_check_rule, test_communication):
    """创建测试检查结果"""
    result = CheckResult(
        rule_id=test_check_rule.id,
        communication_id=test_communication.id,
        status="success",
        start_time=datetime(2026, 3, 25, 14, 30, 0),
        end_time=datetime(2026, 3, 25, 14, 35, 0),
        progress=100,
    )
    db_session.add(result)
    await db_session.commit()
    await db_session.refresh(result)
    return result


@pytest.fixture
async def test_check_result_with_details(db_session, test_check_rule, test_communication, test_check_items):
    """创建带详情的测试检查结果"""
    result = CheckResult(
        rule_id=test_check_rule.id,
        communication_id=test_communication.id,
        status="success",
        start_time=datetime(2026, 3, 25, 14, 30, 0),
        end_time=datetime(2026, 3, 25, 14, 35, 0),
        progress=100,
    )
    db_session.add(result)
    await db_session.flush()

    # 创建详情
    details = []
    for i, item in enumerate(test_check_items):
        detail = CheckResultDetail(
            result_id=result.id,
            check_item_id=item.id,
            status="pass" if i == 0 else ("fail" if i == 1 else "error"),
            expected_value={"permission": "644"},
            actual_value={"permission": "644" if i == 0 else "755"},
            message="" if i == 0 else ("权限不符" if i == 1 else "连接失败"),
        )
        db_session.add(detail)
        details.append(detail)

    await db_session.commit()
    await db_session.refresh(result)
    return result


def _get_override_db(db_session):
    """返回覆盖数据库依赖的函数"""
    async def _override_get_db() -> AsyncGenerator:
        yield db_session
    return _override_get_db


@pytest.mark.asyncio
async def test_check_result_list_item_fields(auth_headers, test_check_result_with_details, db_session):
    """验证 CheckResultListItem 包含新增字段"""
    app.dependency_overrides[get_db] = _get_override_db(db_session)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/checks", headers=auth_headers)
            assert resp.status_code == 200
            data = resp.json()
            # 验证返回字段存在（即使为空值）
            if data:
                item = data[0]
                assert "duration_seconds" in item
                assert "snapshot_id" in item
                assert "snapshot_name" in item
                assert "server_count" in item
                assert "summary" in item
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_check_result_not_found(auth_headers, db_session):
    """验证不存在的检查结果返回 404"""
    app.dependency_overrides[get_db] = _get_override_db(db_session)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/checks/99999", headers=auth_headers)
            assert resp.status_code == 404
    finally:
        app.dependency_overrides.clear()


# 单元测试：验证 Schema 字段定义
def test_check_result_list_item_schema():
    """验证 CheckResultListItem Schema 字段定义"""
    from app.schemas.check import CheckResultListItem
    fields = CheckResultListItem.model_fields
    assert "duration_seconds" in fields
    assert "snapshot_id" in fields
    assert "snapshot_name" in fields
    assert "server_count" in fields
    assert "summary" in fields


def test_check_result_response_schema():
    """验证 CheckResultResponse Schema 字段定义"""
    from app.schemas.check import CheckResultResponse
    fields = CheckResultResponse.model_fields
    assert "snapshot_name" in fields
    assert "duration_seconds" in fields
    assert "summary" in fields
    assert "details" in fields


def test_batch_report_item_schema():
    """验证 BatchReportItem Schema 字段定义"""
    from app.schemas.check import BatchReportItem
    fields = BatchReportItem.model_fields
    assert "rule_id" in fields
    assert "snapshot_id" in fields
    assert "snapshot_name" in fields
    assert "server_count" in fields
    assert "summary" in fields
    assert "result_ids" in fields


# 批量聚合 API 测试
@pytest.mark.asyncio
async def test_batch_report_not_found(auth_headers, db_session):
    """验证不存在的批量报告返回 404"""
    app.dependency_overrides[get_db] = _get_override_db(db_session)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 使用不存在的 rule_id 和 start_time
            resp = await client.get("/api/v1/checks/batch-report/99999/2026-03-25T14:30:00", headers=auth_headers)
            assert resp.status_code == 404
    finally:
        app.dependency_overrides.clear()


# 端到端测试：完整流程
@pytest.mark.asyncio
async def test_e2e_list_to_detail_flow(auth_headers, test_check_result_with_details, db_session):
    """端到端测试：从列表到详情"""
    app.dependency_overrides[get_db] = _get_override_db(db_session)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. 获取列表
            list_resp = await client.get("/api/v1/checks", headers=auth_headers)
            assert list_resp.status_code == 200
            list_data = list_resp.json()
            assert len(list_data) > 0

            # 2. 获取第一个结果的详情
            result_id = list_data[0]["id"]
            detail_resp = await client.get(f"/api/v1/checks/{result_id}", headers=auth_headers)
            assert detail_resp.status_code == 200
            detail_data = detail_resp.json()

            # 3. 验证详情数据完整
            assert detail_data["id"] == result_id
            assert "rule_name" in detail_data
            assert "communication_name" in detail_data
            assert "snapshot_name" in detail_data
            assert "summary" in detail_data
            assert "details" in detail_data
            assert len(detail_data["details"]) == 3
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_e2e_batch_report_aggregation(auth_headers, test_check_result_with_details, db_session, test_check_rule):
    """端到端测试：批量报告聚合"""
    app.dependency_overrides[get_db] = _get_override_db(db_session)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 调用批量聚合 API
            url = f"/api/v1/checks/batch-report/{test_check_rule.id}/2026-03-25T14:30:00"
            resp = await client.get(url, headers=auth_headers)
            assert resp.status_code == 200
            data = resp.json()

            # 验证聚合数据
            assert data["rule_id"] == test_check_rule.id
            assert data["server_count"] >= 1
            assert "summary" in data
            assert data["summary"]["total"] >= 0
            assert "result_ids" in data
            assert len(data["result_ids"]) >= 1
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_e2e_batch_report_invalid_time_format(auth_headers, db_session):
    """端到端测试：批量报告无效时间格式"""
    app.dependency_overrides[get_db] = _get_override_db(db_session)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 使用无效的时间格式
            resp = await client.get("/api/v1/checks/batch-report/1/invalid-time", headers=auth_headers)
            assert resp.status_code == 400
    finally:
        app.dependency_overrides.clear()

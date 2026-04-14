# 环境检查 API
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, CheckResult, CheckResultDetail, CheckRule, Communication, Snapshot
from app.api.users import get_current_active_user
from app.schemas.check import (
    StartCheckRequest,
    StartBatchCheckRequest,
    CheckProgressResponse,
    CheckResultResponse,
    CheckResultListItem,
    CurrentTaskResponse,
    StartCheckResponse,
    StartBatchCheckResponse,
    CancelCheckResponse,
    CheckSummary,
    CheckResultDetailResponse,
    BatchReportItem,
)
from app.services.check_service import CheckExecutionService, CheckExecutionError
from app.services.check_progress import get_progress_tracker
from app.services.check_lock import get_check_lock_manager
from app.tasks.check_tasks import execute_check_task, execute_batch_check_task

router = APIRouter()


@router.post("/start", response_model=StartCheckResponse, status_code=status.HTTP_201_CREATED)
async def start_check(
    request: StartCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    启动单机环境检查

    - 检查规则和快照必须存在
    - 同一时间只能执行一项检查任务
    """
    service = CheckExecutionService(db)

    try:
        # 启动检查（创建记录并获取锁）
        check_result = await service.start_check(
            rule_id=request.rule_id,
            communication_id=request.communication_id,
            snapshot_id=request.snapshot_id,
        )

        # 触发 Celery 异步任务
        execute_check_task.delay(
            result_id=check_result.id,
            rule_id=request.rule_id,
            communication_id=request.communication_id,
            snapshot_id=request.snapshot_id,
        )

        return StartCheckResponse(
            id=check_result.id,
            rule_id=check_result.rule_id,
            status=check_result.status,
            message="检查任务已创建",
            start_time=check_result.start_time,
        )

    except CheckExecutionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/start-batch", response_model=StartBatchCheckResponse, status_code=status.HTTP_201_CREATED)
async def start_batch_check(
    request: StartBatchCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    启动批量环境检查

    为每台通信机创建独立的检查任务
    """
    service = CheckExecutionService(db)

    try:
        # 批量启动检查
        results = await service.start_batch_check(
            rule_id=request.rule_id,
            communication_ids=request.communication_ids,
            snapshot_id=request.snapshot_id,
        )

        # 触发 Celery 异步任务
        for result in results:
            execute_check_task.delay(
                result_id=result.id,
                rule_id=request.rule_id,
                communication_id=result.communication_id,
                snapshot_id=request.snapshot_id,
            )

        return StartBatchCheckResponse(
            created_count=len(results),
            results=[
                StartCheckResponse(
                    id=r.id,
                    rule_id=r.rule_id,
                    status=r.status,
                    start_time=r.start_time,
                )
                for r in results
            ],
            message=f"已为 {len(results)} 台通信机创建检查任务",
        )

    except CheckExecutionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/current", response_model=CurrentTaskResponse)
async def get_current_task(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取当前正在执行的检查任务"""
    service = CheckExecutionService(db)
    task = await service.get_current_task()

    if not task:
        return CurrentTaskResponse(exists=False, status="idle")

    # 获取规则名称
    rule_name = None
    if task.get("rule_id"):
        result = await db.execute(
            select(CheckRule.name).where(CheckRule.id == task["rule_id"])
        )
        rule_name = result.scalar_one_or_none()

    # 获取通信机名称
    comm_name = None
    if task.get("communication_id"):
        result = await db.execute(
            select(Communication.name).where(Communication.id == task["communication_id"])
        )
        comm_name = result.scalar_one_or_none()

    return CurrentTaskResponse(
        exists=True,
        id=task.get("id"),
        rule_id=task.get("rule_id"),
        rule_name=rule_name,
        communication_id=task.get("communication_id"),
        communication_name=comm_name,
        status=task.get("status", "running"),
        progress=task.get("progress", 0),
        total_items=task.get("total_items", 0),
        completed_items=task.get("completed_items", 0),
        current_item=task.get("current_item"),
        message=task.get("message"),
        start_time=datetime.fromisoformat(task["start_time"]) if task.get("start_time") else None,
    )


@router.get("", response_model=List[CheckResultListItem])
async def list_check_results(
    rule_id: Optional[int] = None,
    communication_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查结果列表"""
    query = (
        select(CheckResult)
        .options(
            selectinload(CheckResult.rule).selectinload(CheckRule.snapshot_links),
            selectinload(CheckResult.communication),
            selectinload(CheckResult.details),
        )
        .order_by(CheckResult.start_time.desc())
        .offset(skip)
        .limit(limit)
    )

    if rule_id:
        query = query.where(CheckResult.rule_id == rule_id)
    if communication_id:
        query = query.where(CheckResult.communication_id == communication_id)
    if status_filter:
        query = query.where(CheckResult.status == status_filter)

    result = await db.execute(query)
    results = result.scalars().all()

    snapshot_ids = set()
    for r in results:
        if r.rule and hasattr(r.rule, 'snapshot_links') and r.rule.snapshot_links:
            for link in r.rule.snapshot_links:
                if link.snapshot_id:
                    snapshot_ids.add(link.snapshot_id)

    snapshot_names = {}
    if snapshot_ids:
        snaps_result = await db.execute(select(Snapshot).where(Snapshot.id.in_(snapshot_ids)))
        for s in snaps_result.scalars().all():
            snapshot_names[s.id] = s.name

    items = []
    for r in results:
        # 计算时长
        duration = None
        if r.start_time and r.end_time:
            duration = int((r.end_time - r.start_time).total_seconds())

        # 获取快照信息
        snapshot_id = None
        snapshot_name = None
        if r.rule and hasattr(r.rule, 'snapshot_links') and r.rule.snapshot_links:
            first_snapshot = next((link for link in r.rule.snapshot_links if link.snapshot_id), None)
            if first_snapshot:
                snapshot_id = first_snapshot.snapshot_id
                snapshot_name = snapshot_names.get(snapshot_id)

        # 统计摘要
        summary = CheckSummary()
        for detail in r.details:
            summary.total += 1
            if detail.status == "pass":
                summary.passed += 1
            elif detail.status == "fail":
                summary.failed += 1
            else:
                summary.errors += 1

        items.append(CheckResultListItem(
            id=r.id,
            rule_id=r.rule_id,
            rule_name=r.rule.name if r.rule else None,
            communication_id=r.communication_id,
            communication_name=r.communication.name if r.communication else None,
            status=r.status,
            start_time=r.start_time,
            end_time=r.end_time,
            progress=r.progress,
            error_message=r.error_message,
            duration_seconds=duration,
            snapshot_id=snapshot_id,
            snapshot_name=snapshot_name,
            server_count=1,
            summary=summary,
        ))

    return items


@router.get("/{result_id}", response_model=CheckResultResponse)
async def get_check_result(
    result_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查结果详情"""
    result = await db.execute(
        select(CheckResult)
        .options(
            selectinload(CheckResult.rule).selectinload(CheckRule.snapshot),
            selectinload(CheckResult.communication),
            selectinload(CheckResult.details),
        )
        .where(CheckResult.id == result_id)
    )
    check_result = result.scalar_one_or_none()

    if not check_result:
        raise HTTPException(status_code=404, detail="检查结果不存在")

    # 统计摘要
    summary = CheckSummary()
    for detail in check_result.details:
        summary.total += 1
        if detail.status == "pass":
            summary.passed += 1
        elif detail.status == "fail":
            summary.failed += 1
        else:
            summary.errors += 1

    # 计算时长
    duration = None
    if check_result.start_time and check_result.end_time:
        duration = int((check_result.end_time - check_result.start_time).total_seconds())

    # 构建详情列表
    details = []
    for detail in check_result.details:
        # 获取检查项名称和类型
        from app.models import CheckItem
        item_result = await db.execute(
            select(CheckItem).where(CheckItem.id == detail.check_item_id)
        )
        item = item_result.scalar_one_or_none()

        details.append(CheckResultDetailResponse(
            id=detail.id,
            check_item_id=detail.check_item_id,
            check_item_name=item.name if item else None,
            check_item_type=item.type if item else None,
            status=detail.status,
            expected_value=detail.expected_value,
            actual_value=detail.actual_value,
            message=detail.message,
        ))

    return CheckResultResponse(
        id=check_result.id,
        rule_id=check_result.rule_id,
        rule_name=check_result.rule.name if check_result.rule else None,
        communication_id=check_result.communication_id,
        communication_name=check_result.communication.name if check_result.communication else None,
        communication_ip=check_result.communication.ip_address if check_result.communication else None,
        snapshot_id=check_result.rule.snapshot.id if check_result.rule and check_result.rule.snapshot else None,
        snapshot_name=check_result.rule.snapshot.name if check_result.rule and check_result.rule.snapshot else None,
        status=check_result.status,
        start_time=check_result.start_time,
        end_time=check_result.end_time,
        progress=check_result.progress,
        error_message=check_result.error_message,
        duration_seconds=duration,
        summary=summary,
        details=details,
    )


@router.get("/{result_id}/progress", response_model=CheckProgressResponse)
async def get_check_progress(
    result_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查进度"""
    result = await db.execute(
        select(CheckResult).where(CheckResult.id == result_id)
    )
    check_result = result.scalar_one_or_none()

    if not check_result:
        raise HTTPException(status_code=404, detail="检查结果不存在")

    # 获取 Redis 中的进度详情
    progress_tracker = get_progress_tracker()
    progress_data = await progress_tracker.get_progress(result_id)

    return CheckProgressResponse(
        id=check_result.id,
        status=check_result.status,
        progress=check_result.progress,
        total_items=progress_data.get("total_items", 0),
        completed_items=progress_data.get("completed_items", 0),
        current_item=progress_data.get("current_item"),
        message=progress_data.get("message"),
        start_time=check_result.start_time,
    )


@router.delete("/{result_id}", response_model=CancelCheckResponse)
async def cancel_check(
    result_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """取消检查任务"""
    service = CheckExecutionService(db)
    cancelled = await service.cancel_check(result_id)

    if cancelled:
        return CancelCheckResponse(
            success=True,
            message="检查任务已取消"
        )
    return CancelCheckResponse(
        success=False,
        message="无法取消检查任务（任务可能已结束或不存在）"
    )


@router.get("/{result_id}/export")
async def export_check_result(
    result_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_active_user),
):
    """导出检查结果为 PDF 或 Excel"""
    try:
        from app.services.report_exporter import export_check_result
        content = export_check_result(result_id, format)
        media_type = "application/pdf" if format.lower() == "pdf" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"check_result_{result_id}.{format}"

        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.get("/batch-report/{rule_id}/{start_time}", response_model=BatchReportItem)
async def get_batch_report(
    rule_id: int,
    start_time: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取批量检查聚合报告
    按 rule_id + start_time 聚合所有 CheckResult
    """
    # 解析开始时间 (ISO format: "2026-03-25T14:30:00")
    try:
        start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的时间格式，请使用 ISO 格式")

    # 查询同批次的所有 CheckResult（时间窗口 ±60 秒）
    query = (
        select(CheckResult)
        .options(
            selectinload(CheckResult.rule).selectinload(CheckRule.snapshot),
            selectinload(CheckResult.communication),
            selectinload(CheckResult.details),
        )
        .where(
            CheckResult.rule_id == rule_id,
            CheckResult.start_time >= start_dt - timedelta(seconds=60),
            CheckResult.start_time <= start_dt + timedelta(seconds=60),
        )
        .order_by(CheckResult.start_time.desc())
    )
    result = await db.execute(query)
    results = result.scalars().all()

    if not results:
        raise HTTPException(status_code=404, detail="未找到对应的批量检查结果")

    # 聚合统计数据
    total_passed = 0
    total_failed = 0
    total_errors = 0

    for r in results:
        for detail in r.details:
            if detail.status == "pass":
                total_passed += 1
            elif detail.status == "fail":
                total_failed += 1
            else:
                total_errors += 1

    total_items = total_passed + total_failed + total_errors

    # 使用第一个结果作为基准
    first = results[0]

    # 计算时长
    duration = None
    if first.start_time and first.end_time:
        duration = int((first.end_time - first.start_time).total_seconds())

    # 获取快照信息
    snapshot_id = None
    snapshot_name = None
    if first.rule and first.rule.snapshot:
        snapshot_id = first.rule.snapshot.id
        snapshot_name = first.rule.snapshot.name

    return BatchReportItem(
        id=first.id,
        rule_id=first.rule_id,
        rule_name=first.rule.name if first.rule else None,
        snapshot_id=snapshot_id,
        snapshot_name=snapshot_name,
        start_time=first.start_time,
        end_time=first.end_time,
        duration_seconds=duration,
        server_count=len(results),
        summary=CheckSummary(
            total=total_items,
            passed=total_passed,
            failed=total_failed,
            errors=total_errors,
        ),
        result_ids=[r.id for r in results],
    )

# 报告生成模块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现报告生成模块，包括后端 API 扩展、批量聚合、PDF 状态值统一，以及前端报告列表页和详情页

**Architecture:** 轻量前端渲染 + 复用后端 reportlab PDF 导出。前端通过 `GET /api/v1/checks/batch-report` 获取聚合数据，渲染报告列表和详情；PDF 导出调用后端已有端点。

**Tech Stack:** FastAPI + SQLAlchemy + aiosqlite + Pydantic + reportlab + 原生 HTML/JS（无框架）

---

## 文件结构

```
Backend:
  app/schemas/check.py                — 扩展 CheckResultListItem 字段、新增 BatchReportItem
  app/api/checks.py                   — 新增批量聚合 API，填充 snapshot_name
  app/services/report_exporter.py      — 统一 detail 状态值为 pass/fail/error

Frontend:
  app/static/reports.html             — 报告列表页（新建）
  app/static/report-detail.html       — 报告详情页（新建）
  app/static/js/reports.js            — 报告列表 JS（重写）
  app/static/js/report-detail.js      — 报告详情 JS（新建）

Tests:
  tests/integration/api/test_checks.py        — 新建，新增检查 API 测试
  tests/unit/services/test_report_exporter.py — 新建，PDF 导出测试

Static assets:
  app/static/css/style.css            — 复用现有样式，新增报告页相关样式
```

---

## 实现任务

### Task 1: 后端 — Schema 字段扩展

**Files:**
- Modify: `app/schemas/check.py`
- Create: `tests/integration/api/test_checks.py`

> **注意：** `tests/integration/api/` 目录不存在，需先创建目录和 `__init__.py`

- [ ] **Step 1: 创建测试目录**

```bash
mkdir -p tests/integration/api
touch tests/integration/api/__init__.py
touch tests/unit/services/__init__.py
```

- [ ] **Step 2: 扩展 CheckResultListItem**

在 `app/schemas/check.py` 的 `CheckResultListItem` 类中增加字段：

```python
class CheckResultListItem(BaseModel):
    """检查结果列表项（简化版）"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    rule_id: Optional[int] = None
    rule_name: Optional[str] = None
    communication_id: Optional[int] = None
    communication_name: Optional[str] = None
    status: str
    start_time: datetime
    end_time: Optional[datetime] = None
    progress: int = 0
    error_message: Optional[str] = None
    # 新增字段
    duration_seconds: Optional[int] = None
    snapshot_id: Optional[int] = None
    snapshot_name: Optional[str] = None
    server_count: int = 1
    summary: Optional[CheckSummary] = None
```

> **注：** `CheckSummary` 在同一文件中定义，Pydantic 无需 import 即可引用。

- [ ] **Step 3: 确保 CheckResultResponse.snapshot_name 被正确填充**

检查 `CheckResultResponse` 中 `snapshot_name` 字段（schema 中已存在），API 层需关联 Snapshot 表获取名称。在 `app/api/checks.py` 的 `get_check_result()` 中补充获取 `snapshot_name` 的逻辑。

- [ ] **Step 4: 添加集成测试**

创建 `tests/integration/api/test_checks.py`，测试 `CheckResultListItem` 新增字段的序列化。

```python
"""检查 API 集成测试"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_check_result_list_item_fields(auth_headers, test_user, test_check_rule):
    """验证 CheckResultListItem 包含新增字段"""
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
```

Run: `pytest tests/integration/api/test_checks.py -v`

- [ ] **Step 5: Commit**

```bash
git add app/schemas/check.py tests/integration/api/test_checks.py
git commit -m "feat(api): extend CheckResultListItem with new fields

Add duration_seconds, snapshot_id, snapshot_name, server_count,
summary fields to CheckResultListItem for report list display."
```

---

### Task 2: 后端 — 批量聚合 API

**Files:**
- Modify: `app/api/checks.py`
- Modify: `app/schemas/check.py`

- [ ] **Step 1: 新增 BatchReportItem Schema**

在 `app/schemas/check.py` 中添加：

```python
class BatchReportItem(BaseModel):
    """批量检查聚合报告"""
    id: int
    rule_id: Optional[int] = None
    rule_name: Optional[str] = None
    snapshot_id: Optional[int] = None
    snapshot_name: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    server_count: int = 1
    summary: CheckSummary = Field(default_factory=CheckSummary)
    result_ids: List[int] = []
```

- [ ] **Step 2: 实现批量聚合 API**

在 `app/api/checks.py` 中新增端点 `GET /api/v1/checks/batch-report/{rule_id}/{start_time}`：

```python
@router.get("/batch-report/{rule_id}/{start_time}", response_model=BatchReportItem)
async def get_batch_report(
    rule_id: int,
    start_time: str,  # ISO format: "2026-03-25T14:30:00"
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取批量检查聚合报告
    按 rule_id + start_time 聚合所有 CheckResult
    """
    from datetime import datetime, timedelta

    start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))

    query = (
        select(CheckResult)
        .options(
            selectinload(CheckResult.rule).selectinload("snapshot"),
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

    total_passed = sum(
        sum(1 for d in r.details if d.status == "pass")
        for r in results
    )
    total_failed = sum(
        sum(1 for d in r.details if d.status == "fail")
        for r in results
    )
    total_errors = sum(
        sum(1 for d in r.details if d.status == "error")
        for r in results
    )
    total_items = total_passed + total_failed + total_errors

    first = results[0]
    duration = None
    if first.start_time and first.end_time:
        duration = int((first.end_time - first.start_time).total_seconds())

    return BatchReportItem(
        id=first.id,
        rule_id=first.rule_id,
        rule_name=first.rule.name if first.rule else None,
        snapshot_id=first.rule.snapshot_id if first.rule else None,
        snapshot_name=first.rule.snapshot.name if (first.rule and first.rule.snapshot) else None,
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
```

- [ ] **Step 3: 添加 import**

在 `app/api/checks.py` 顶部确保已导入 `timedelta`（from datetime import datetime, timedelta）和 `BatchReportItem`（from app.schemas.check import ...）。

- [ ] **Step 4: 添加集成测试**

在 `tests/integration/api/test_checks.py` 中添加 `test_batch_report` 测试：
1. 创建 1 个 rule + 3 个 communication
2. 启动批量检查（创建 3 个 CheckResult）
3. 调用 batch-report API
4. 验证返回数据正确聚合（server_count=3, summary 正确）

Run: `pytest tests/integration/api/test_checks.py::test_batch_report -v`

- [ ] **Step 5: Commit**

```bash
git add app/api/checks.py app/schemas/check.py tests/integration/api/test_checks.py
git commit -m "feat(api): add batch report aggregation endpoint

New GET /api/v1/checks/batch-report/{rule_id}/{start_time}
aggregates multiple CheckResult records into a single report card."
```

---

### Task 3: 后端 — PDF 状态值统一

**Files:**
- Modify: `app/services/report_exporter.py`
- Create: `tests/unit/services/test_report_exporter.py`

> **注意：** 只修改 detail 级别的 `status_map`（处理 `CheckResultDetail.status`：`pass`/`fail`/`error`），不修改 top-level `status_text`（处理 `CheckResult.status`：`success`/`failed`/`running` 等）。

- [ ] **Step 1: 修改 PDFExporter detail 级别状态映射**

在 `app/services/report_exporter.py` 的 `PDFExporter.export()` 中，找到 detail 级别的 status_map，改为：

```python
status_map = {"pass": "通过", "fail": "失败", "error": "异常"}
```

> **不要修改** top-level `status_text` 字典（它处理 `CheckResult.status` 字段，值域为 `success/failed/running/cancelled/completed_with_errors`）。

同样修改 `ExcelExporter` 中的 detail-level status_map。

- [ ] **Step 2: 创建单元测试**

创建 `tests/unit/services/test_report_exporter.py`：

```python
"""report_exporter 单元测试"""
import pytest
from app.services.report_exporter import PDFExporter, ExcelExporter


def test_pdf_exporter_pass_fail_error_labels():
    """验证 PDF 导出器使用 pass/fail/error 状态标签"""
    exporter = PDFExporter()
    data = {
        "result_id": 1,
        "rule_name": "测试规则",
        "communication_name": "测试通信机",
        "status": "success",
        "start_time": "2026-03-25 14:30:00",
        "end_time": "2026-03-25 14:35:00",
        "details": [
            {"check_item_id": 1, "status": "pass", "expected_value": {}, "actual_value": {}, "message": ""},
            {"check_item_id": 2, "status": "fail", "expected_value": {}, "actual_value": {}, "message": "权限不符"},
            {"check_item_id": 3, "status": "error", "expected_value": {}, "actual_value": {}, "message": "连接失败"},
        ]
    }
    pdf_bytes = exporter.export(data)
    assert pdf_bytes.startswith(b"%PDF")
    # 验证 PDF 包含正确的中文状态标签（"通过"/"失败"/"异常"的 UTF-8 字节）
    assert b"\xe9\x80\x89\xe9\x80\x9a" in pdf_bytes  # "通过"
    assert b"\xe5\xa4\xb1\xe8\xb4\xa5" in pdf_bytes   # "失败"
    assert b"\xe5\xbc\x82\xe5\xb8\xb8" in pdf_bytes  # "异常"
```

Run: `pytest tests/unit/services/test_report_exporter.py -v`

- [ ] **Step 3: Commit**

```bash
git add app/services/report_exporter.py tests/unit/services/test_report_exporter.py
git commit -m "fix(report): unify PDF/Excel detail status to pass/fail/error

Align CheckResultDetail status mapping with API conventions.
Top-level status_text (success/failed/running) left unchanged."
```

---

### Task 4: 前端 — 报告列表页

**Files:**
- Create: `app/static/reports.html`
- Modify: `app/static/js/reports.js`
- Modify: `app/static/css/style.css`

- [ ] **Step 1: 创建报告列表页 HTML**

`app/static/reports.html` — 独立页面，包含：
- 顶部导航栏（复用 dashboard 风格）
- 顶部筛选栏（时间范围、规则、状态）
- 报告卡片列表（按 spec 第3节设计）
- 每个卡片有「查看报告」和「导出PDF」按钮
- 加载状态骨架屏

页面可直接复用 `dashboard.html` 的 CSS 和 `common.js`，不依赖 dashboard 的 JS 上下文。

- [ ] **Step 2: 重写 reports.js**

重写 `app/static/js/reports.js`，实现：
- `loadBatchReports()` — 调用 `GET /api/v1/checks/batch-report` 获取聚合数据
- 渲染报告卡片列表
- 支持筛选（时间、规则、状态）和排序
- 「查看报告」跳转到 `report-detail.html`
- 「导出PDF」调用 `/api/v1/checks/{id}/export?format=pdf`

- [ ] **Step 3: 添加 CSS 样式**

在 `app/static/css/style.css` 末尾添加报告列表卡片样式（沿用深交所风格配色）。

- [ ] **Step 4: 本地测试**

启动应用，访问 `/reports.html`，验证报告列表正常加载。

- [ ] **Step 5: Commit**

```bash
git add app/static/reports.html app/static/js/reports.js app/static/css/style.css
git commit -m "feat(frontend): add report list page

New /reports.html with batch report cards, filtering, and PDF export."
```

---

### Task 5: 前端 — 报告详情页

**Files:**
- Create: `app/static/report-detail.html`
- Create: `app/static/js/report-detail.js`

- [ ] **Step 1: 创建报告详情页 HTML**

`app/static/report-detail.html` — 包含：
- 顶部概览卡片（执行信息 + 汇总统计）
- 汇总表（缩略展示，失败/异常高亮）
- 明细展开/折叠
- PDF 导出按钮
- 全部展开/全部折叠按钮

- [ ] **Step 2: 创建报告详情 JS**

`app/static/js/report-detail.js` 实现：
- 从 URL 参数获取 `result_id`
- 调用 `GET /api/v1/checks/{result_id}` 获取详情
- 按 `check_item_id` 分组聚合多个 `CheckResult` 的详情
- 渲染缩略视图（收起状态）
- 点击展开查看每台服务器的详细结果
- 筛选、排序功能
- PDF 导出按钮调用后端 API

- [ ] **Step 3: JSON 格式化函数**

在 `report-detail.js` 中实现 `formatValue(value, checkType)` 函数：
- `file`: 提取 permission, owner, size
- `process`: 提取 pid, status, memory
- `port`: 提取 port, state
- `log`: 提取 matched_lines, error_count
- 其他：直接显示 JSON 字符串

- [ ] **Step 4: 本地测试**

访问 `/report-detail.html?result_id=1`，验证：
- 概览卡片正确显示
- 汇总表缩略展示正常
- 展开/折叠交互正常
- PDF 导出功能正常

- [ ] **Step 5: Commit**

```bash
git add app/static/report-detail.html app/static/js/report-detail.js
git commit -m "feat(frontend): add report detail page

New /report-detail.html with overview, summary table, expand/collapse
details, and JSON value formatting by check type."
```

---

### Task 6: 端到端测试

**Files:**
- Modify: `tests/integration/api/test_checks.py`

- [ ] **Step 1: 完整流程测试**

在 `tests/integration/api/test_checks.py` 中添加端到端测试，覆盖：
1. 启动批量检查 → 获取批量报告 → 获取单个报告详情 → 导出 PDF
2. 验证报告列表 API 返回正确字段
3. 验证 PDF 内容包含正确状态标签（"通过"/"失败"/"异常"）

Run: `pytest tests/integration/api/test_checks.py -v`

- [ ] **Step 2: Commit**

```bash
git add tests/integration/api/test_checks.py
git commit -m "test: add e2e tests for report generation flow

Cover batch aggregation, detail API, and PDF export."
```

---

## 执行顺序

| Task | 名称 | 依赖 |
|------|------|------|
| 1 | 后端 Schema 扩展 | 无 |
| 2 | 后端批量聚合 API | Task 1 |
| 3 | PDF 状态值统一 | Task 2（确保 API 和 PDF 状态值同步） |
| 4 | 前端报告列表页 | Task 2 (API 就绪) |
| 5 | 前端报告详情页 | Task 2 (API 就绪) |
| 6 | 端到端测试 | Task 1-5 全部 |

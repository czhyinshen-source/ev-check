# Check Report Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `CheckReport` aggregation model, decouple the execution console from rule management, and create a centralized Task & Report Center with a cascading drill-down UI.

**Architecture:** We will add a `CheckReport` model to aggregate the batch execution of `CheckResult`s. The execution flow will first create a Report, then dispatch tasks. Frontend will be refactored to focus the "Checks" tab on rules and the "Reports" tab on monitoring (both manual and scheduled) and detailed hierarchical results.

**Tech Stack:** FastAPI, SQLAlchemy (Async), Celery, Vanilla JS, HTML/CSS.

---

### Task 1: Database Models & Schema Management

**Files:**
- Modify: `app/models/check_result.py:10-20`
- Modify: `app/models/__init__.py:1-10`
- Create: `scripts/alter_db_report.py`

- [ ] **Step 1: Write `CheckReport` Model**

Modify `app/models/check_result.py` to add `CheckReport` class before `CheckResult` and add `report_id` to `CheckResult`.

```python
class CheckReport(Base):
    __tablename__ = "check_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_id: Mapped[Optional[int]] = mapped_column(ForeignKey("check_rules.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(20), default="manual")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    total_nodes: Mapped[int] = mapped_column(Integer, default=0)
    completed_nodes: Mapped[int] = mapped_column(Integer, default=0)
    success_nodes: Mapped[int] = mapped_column(Integer, default=0)
    failed_nodes: Mapped[int] = mapped_column(Integer, default=0)
    start_time: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    rule: Mapped[Optional["CheckRule"]] = relationship("CheckRule", backref="reports")
    results: Mapped[list["CheckResult"]] = relationship("CheckResult", back_populates="report", cascade="all, delete-orphan")

# In CheckResult:
report_id: Mapped[Optional[int]] = mapped_column(ForeignKey("check_reports.id", ondelete="CASCADE"), nullable=True)
report: Mapped[Optional["CheckReport"]] = relationship("CheckReport", back_populates="results")
```

- [ ] **Step 2: Create local DB alter script**

Create `scripts/alter_db_report.py` to run raw SQL schema updates for local testing to avoid recreation issues.
```python
import asyncio
from app.database import engine
from sqlalchemy import text

async def alter_db():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE check_results ADD COLUMN report_id INTEGER REFERENCES check_reports(id) ON DELETE CASCADE;"))
            print("Altered check_results")
        except Exception as e:
            print("Alter error:", e)
            
if __name__ == "__main__":
    asyncio.run(alter_db())
```

- [ ] **Step 3: Run the alter script**

Run: `PYTHONPATH=. python scripts/alter_db_report.py`
Expected: Passes without crashing.

- [ ] **Step 4: Commit**

```bash
git add app/models/check_result.py scripts/alter_db_report.py
git commit -m "feat(db): add CheckReport model and associate CheckResult"
```

### Task 2: Service Layer & Background Execution Flow

**Files:**
- Modify: `app/services/check_service.py`
- Modify: `app/tasks/check_tasks.py`

- [ ] **Step 1: Update rule generation in `check_service.py`**

In `CheckExecutionService.execute_rule`, generate a `CheckReport`.

```python
# Before generating check_result records:
report = CheckReport(
    rule_id=rule.id,
    name=f"{rule.name} - {datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
    trigger_type="manual",
    status="running",
    total_nodes=len(communications),
    start_time=datetime.utcnow()
)
self.db.add(report)
await self.db.flush()

for comm in communications:
    check_result = CheckResult(
        report_id=report.id,
        # ... logic ...
```

- [ ] **Step 2: Update Check Task atomic completion**

In `app/services/check_service.py`, handle result update at the end of checking. Use atomic updates to avoid race conditions.

```python
# Provide an update_report_progress method
async def update_report_progress(self, report_id: int, is_success: bool):
    from sqlalchemy import update, select
    stmt = update(CheckReport).where(CheckReport.id == report_id).values(
        completed_nodes=CheckReport.completed_nodes + 1,
        success_nodes=CheckReport.success_nodes + (1 if is_success else 0),
        failed_nodes=CheckReport.failed_nodes + (0 if is_success else 1)
    )
    await self.db.execute(stmt)
    await self.db.commit()
    # Check if finished
    result = await self.db.execute(select(CheckReport).where(CheckReport.id == report_id))
    report = result.scalar_one()
    if report.completed_nodes >= report.total_nodes:
        report.status = "failed" if report.failed_nodes > 0 else "success"
        report.end_time = datetime.utcnow()
        await self.db.commit()
```

- [ ] **Step 3: Connect update to `execute_check` flow**

In `execute_check`, ensure `update_report_progress` is called appropriately when the specific node's task wraps up.

- [ ] **Step 4: Commit**

```bash
git add app/services/check_service.py app/tasks/check_tasks.py
git commit -m "feat(service): implement check report task flow and atomic updates"
```

### Task 3: API Layer for Reports

**Files:**
- Create: `app/api/reports.py`
- Modify: `app/main.py` (to mount router)

- [ ] **Step 1: Create `app/api/reports.py` router**

Implement endpoints:
- `GET /reports`: List `CheckReport`s (order by id desc)
- `GET /reports/{report_id}`: Get Report info.
- `GET /reports/{report_id}/details`: Get 4-level deep data (Group by Check Item -> Machines -> Diffs). It aggregates data from `CheckResultDetail` joined with `CheckResult` and `Communication`.

- [ ] **Step 2: Start server and test**

Run: `pytest tests/api/test_reports.py` (if tests exist) or use `curl` to verify creation logic. Fast check with unit tests logic or manual inspection.

- [ ] **Step 3: Mount router in main.py**

Modify `app/main.py` adding `app.include_router(reports.router, prefix="/api/v1/reports")`.

- [ ] **Step 4: Commit**

```bash
git add app/api/reports.py app/main.py
git commit -m "feat(api): add reports CRUD and aggregation endpoints"
```

### Task 4: Frontend - Decoupling Rule Execution

**Files:**
- Modify: `app/static/dashboard.html`
- Modify: `app/static/js/checks.js`

- [ ] **Step 1: Remove Console from `dashboard.html`**

Delete the `#resultPanel` div at the bottom of the "checks" tab (`<div class="result-panel" id="resultPanel">`).

- [ ] **Step 2: Update `checks.js` Execution Trigger**

```javascript
async function executeCurrentRule() {
    // ... trigger execution ...
    // Redirect to reports
    alert('任务已派发！即将前往报表中心查看');
    document.querySelector('.nav-tab[data-tab="reports"]').click();
    window.reports.loadReports();
}
```

- [ ] **Step 3: Verify execution logic**

Confirm clicking execute throws you to the Reports tab.

- [ ] **Step 4: Commit**

```bash
git add app/static/dashboard.html app/static/js/checks.js
git commit -m "refactor(ui): decouple check execution console from rules tab"
```

### Task 5: Frontend - Task & Report Center Main List

**Files:**
- Modify: `app/static/dashboard.html`
- Modify: `app/static/js/reports.js`

- [ ] **Step 1: HTML Layout changes for Reports Tab**

Redesign the `#reports` tab to show a list of `CheckReport` (Table headers: Name, Trigger, Progress, Status, Time, Actions).

- [ ] **Step 2: JS Fetch and Render**

Update `reports.js` `loadReports()` to hit `/api/v1/reports`. Render progress bars using `${completed_nodes}/${total_nodes}` with standard CSS. Status badges for running/success/failed.

- [ ] **Step 3: Set up Polling for Active Reports**

If any report is "running", `reports.js` should set a `setTimeout` to poll `/api/v1/reports` every 2s.

- [ ] **Step 4: Commit**

```bash
git add app/static/dashboard.html app/static/js/reports.js
git commit -m "feat(ui): implement main unified report and task center list"
```

### Task 6: Frontend - Report Cascading Drill-Down Modal

**Files:**
- Modify: `app/static/css/style.css`
- Modify: `app/static/dashboard.html`
- Modify: `app/static/js/reports.js`

- [ ] **Step 1: Modal HTML Structure**

Add `#reportDetailModalOverlay` with:
- Top Radar/Summary area.
- Body area `<div>` for the cascading accordion.

- [ ] **Step 2: Render Level 1 & Level 2**

Implement `window.reports.viewReport(reportId)` fetching `/api/v1/reports/{id}/details`.
Process response into a tree mapping: `Check Item -> Communications`.
Render items. Toggle click on item expands child Communications.

- [ ] **Step 3: Render Level 3 (Diff View)**

Clicking an abnormal communication renders the comparison. 
```javascript
// Render Git-style diff
function renderDiff(expected, actual) {
    // Green background for actual matches, Red background/strikethrough for mismatches
    return `<div class="diff-view"><div class="left">${formatExpected}</div><div class="right">${formatActual}</div></div>`;
}
```

- [ ] **Step 4: Add CSS Stylings**

Add `.diff-view`, `.accordion-item`, `.status-green`, `.status-red` targeting modern IDE UI structure.

- [ ] **Step 5: Verify Interaction**

Confirm the cascading from `Report -> Check Item -> Machine -> Diff` works correctly in the browser.

- [ ] **Step 6: Commit**

```bash
git add app/static/css/style.css app/static/dashboard.html app/static/js/reports.js
git commit -m "feat(ui): add 4-level cascading hierarchical report detail modal"
```

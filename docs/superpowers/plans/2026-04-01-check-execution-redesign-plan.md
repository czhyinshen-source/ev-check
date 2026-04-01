# Check Execution Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Check Execution system to use a centralized Check Rule concept with robust many-to-many relationships and a sidebar-based UI.

**Architecture:** We are updating the `CheckRule` model to decouple it from single snapshots and single check item lists. Instead, three association tables map a Rule to specific and grouped Snapshots, Check Items, and Communications. We will rewrite the Check Rule API to support CRUD with full relation replacement and implement an `execute` endpoint. The frontend will get a two-column sidebar-details layout for managing rules and triggering executions.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, Vanilla JS, HTML/CSS.

---

### Task 1: Database Model Updates

**Files:**
- Modify: `app/models/check_result.py:11-46`
- Modify: `app/models/__init__.py:1-20`

-[x] **Step 1: Write the failing tests for new models**
```python
# Create tests/unit/models/test_check_rule_relations.py
import pytest
from app.models.check_result import CheckRule, CheckRuleSnapshot
from sqlalchemy import select

@pytest.mark.asyncio
async def test_check_rule_snapshot_relation(db_session, test_snapshot):
    rule = CheckRule(name="Test Rule")
    db_session.add(rule)
    await db_session.flush()
    rel = CheckRuleSnapshot(rule_id=rule.id, snapshot_id=test_snapshot.id)
    db_session.add(rel)
    await db_session.commit()
    assert rel.id is not None
```

-[x] **Step 2: Run test to verify it fails**
Run: `pytest tests/unit/models/test_check_rule_relations.py -v`
Expected: FAIL due to missing `CheckRuleSnapshot` and new properties.

-[x] **Step 3: Update `CheckRule` and add association models**
In `app/models/check_result.py`:
- Add `CheckRuleSnapshot`, `CheckRuleCheckItem`, `CheckRuleCommunication` classes.
- Update `CheckRule`: Remove `check_item_list_id` and `snapshot_id`. Add `description`, `is_active`, `allow_manual_execution`, `cron_expression`, `time_window_start`, `time_window_end`, `time_window_weekdays`, `created_at`, `updated_at`.
- Add relationships in `CheckRule` to the association lists.

-[x] **Step 4: Update `app/models/__init__.py`**
Include the new models in the `__all__` exported list.

-[x] **Step 5: Run test to verify it passes**
Run: `pytest tests/unit/models/test_check_rule_relations.py -v`
Expected: PASS

-[x] **Step 6: Commit**
Run: `git add app/models tests/unit/models` and commit with message "feat(db): update check rule data structures and relations".

---

### Task 2: Schema Updates

**Files:**
- Modify: `app/schemas/check_rule.py:1-40`

- [ ] **Step 1: Write failing schema tests**
```python
# Create tests/unit/schemas/test_check_rule_schema.py
import pytest
from app.schemas.check_rule import CheckRuleCreate

def test_check_rule_create_schema():
    payload = {
        "name": "Rule 1", "is_active": True, "allow_manual_execution": True,
        "snapshot_ids": [1], "snapshot_group_ids": [],
        "check_item_ids": [], "check_item_list_ids": [1],
        "communication_ids": [1], "communication_group_ids": []
    }
    obj = CheckRuleCreate(**payload)
    assert obj.snapshot_ids == [1]
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest tests/unit/schemas/test_check_rule_schema.py -v`
Expected: FAIL due to missing array fields in Pydantic schema.

- [ ] **Step 3: Update Schemas**
Update `CheckRuleBase`, `CheckRuleCreate`, `CheckRuleUpdate`, `CheckRuleResponse` in `app/schemas/check_rule.py`. Include fields like `is_active`, arrays of identifiers (`snapshot_ids`, `snapshot_group_ids`, etc.), and counts or relation objects for the responses.

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest tests/unit/schemas/test_check_rule_schema.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
Run: `git add app/schemas tests/unit/schemas` and commit with message "feat(api): update check rule pydantic schemas".

---

### Task 3: Backend API - Check Rules CRUD

**Files:**
- Modify: `app/api/check_rules.py:1-150`

- [ ] **Step 1: Write API tests**
```python
# Create tests/unit/api/test_check_rules_api.py
import pytest

@pytest.mark.asyncio
async def test_create_check_rule_api(client, auth_headers):
    payload = {
        "name": "API Rule", "is_active": True, "allow_manual_execution": True,
        "snapshot_ids": [], "snapshot_group_ids": [],
        "check_item_ids": [], "check_item_list_ids": [],
        "communication_ids": [], "communication_group_ids": []
    }
    res = await client.post("/api/v1/check-rules", json=payload, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "API Rule"
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest tests/unit/api/test_check_rules_api.py -v`
Expected: FAIL contextually because backend relies on old structures.

- [ ] **Step 3: Refactor CRUD Endpoints**
In `app/api/check_rules.py`, handle creation and full replacement updates. Ensure `db.add()` handles the nested association models correctly. Add `PATCH /api/v1/check-rules/{id}/toggle`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest tests/unit/api/test_check_rules_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
Run: `git add app/api tests/unit/api` and commit with message "feat(api): implement advanced check rules CRUD".

---

### Task 4: Backend API - Check Execution Logic

**Files:**
- Modify: `app/services/check_service.py`
- Modify: `app/api/check_rules.py`

- [ ] **Step 1: Write execution service test**
```python
# Add to tests/unit/services/test_check_rule_execute.py
import pytest
from app.services.check_service import CheckExecutionService

@pytest.mark.asyncio
async def test_execute_rule_expansion(db_session, test_snapshot, test_communication):
    # Setup mock rule spanning 1 comm and 1 snapshot
    # Call CheckExecutionService.execute_rule(rule_id)
    # Check if correct Celery tasks are spawned
    pass
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest tests/unit/services/test_check_rule_execute.py -v`
Expected: FAIL since execution logic does not support flattening associations.

- [ ] **Step 3: Implement Flattening and Execute API**
- Implement an `execute_rule` method in `CheckExecutionService` that gathers all specific snapshots/groups, check items/lists, and communications/groups into distinct lists, cross-joins them to build pending CheckResults, and fires Celery jobs.
- Add `POST /api/v1/check-rules/{id}/execute` to `app/api/check_rules.py`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest tests/unit/services/test_check_rule_execute.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
Run: `git add app/api app/services` and commit with message "feat(services): implement check rule execution and relationship flattening".

---

### Task 5: Frontend UI - Dashboard Structure

**Files:**
- Modify: `app/static/dashboard.html`
- Modify: `app/static/css/style.css`

- [ ] **Step 1: Rewrite Check Tab Layout**
In `app/static/dashboard.html`, replace the `#checks` tab-content to match the side-bar layout of `#communications`. Add a left sidebar for the rule list and a main content area for rule details, editing forms, and related item pills. Include modals for selecting communications, snapshots, and check items.

- [ ] **Step 2: Component CSS styling**
Update `app/static/css/style.css` to cover rule item selections, detail display grids, and association pills (`var(--bg-*)`, etc., matching Control Room aesthetic).

- [ ] **Step 3: Verification**
Load `http://localhost:8000/dashboard.html` manually or via playwright to confirm the layout is present.

- [ ] **Step 4: Commit**
Run: `git add app/static/dashboard.html app/static/css/style.css` and commit with message "feat(ui): sidebar layout for check execution tab".

---

### Task 6: Frontend JS - Rules Management

**Files:**
- Modify: `app/static/js/checks.js`

- [ ] **Step 1: Implement State Management and Renderers**
Overhaul `checks.js`. Maintain `currentRuleId`. Complete methods to `loadCheckRules()` into the sidebar. Implement `renderRuleDetails(ruleId)`. 

- [ ] **Step 2: Implement Save/Update Logic**
Hook up the detail form to save to `POST`/`PUT` check-rules API endpoint. Extract values from selection lists for relation properties. Add delete and status toggle operations.

- [ ] **Step 3: Verification**
Ensure adding/editing rules correctly updates the UI and backend visually in the browser.

- [ ] **Step 4: Commit**
Run: `git add app/static/js/checks.js` and commit with message "feat(ui): check rules sidebar logic and form integration".

---

### Task 7: Frontend JS - Execution Integration

**Files:**
- Modify: `app/static/js/checks.js`

- [ ] **Step 1: Build the Selection Modals**
Implement the JS for opening multiple-selection modals (Groups vs Individual items) for the three association types. Use dual-tab or split modal concepts ensuring real-time count summaries.

- [ ] **Step 2: Execution Trigger**
Wire the "Execute" button to present the confirmation dialog parsing flattened counts. Upon confirm, invoke `POST /api/v1/check-rules/{id}/execute`. Display progress bars mapped via the existing polling endpoint.

- [ ] **Step 3: Verification**
Verify the start-to-finish execution flow logs correctly and redirects to the check reports upon completion.

- [ ] **Step 4: Commit**
Run: `git commit -a -m "feat(ui): execution dialogs and relation selection modals"`

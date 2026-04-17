# 多实例靶向执行架构 (Multi-Target Execution) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有的统一扁平配置模式升级为灵活的“基于快照的动态执行队列行”，并新增删除资产时的防呆联动拦截保护。

**Architecture:** 
1. 废弃数据库关联映射，改为在 `CheckRule` 表存储原生的 `execution_targets (JSON)`。
2. 通过 Python 应用层完成跨资源（快照、通信机、检查项）删除前的关联查询和拦截预警。
3. 执行引流：解析 JSON 将统一任务分裂为针对单个快照的精准独立检查组。
4. 前端重构：剥离传统三等分卡片，转为具有“+ 添加对比行”交互阵列，联动式异步获取快照下属预填机具池。

**Tech Stack:** Python, FastAPI, SQLAlchemy (JSON Column), Vanilla JS, HTML/CSS.

---

### Task 1: 数据流改造 (Models & Schemas)

**Files:**
- Modify: `app/models/check_result.py`
- Modify: `app/schemas/check_rule.py`

- [ ] **Step 1: 移除老旧的关联 Model 并增加 JSON 字段**
在 `app/models/check_result.py` 中：
- 删除 `CheckRuleSnapshot`, `CheckRuleCheckItem`, `CheckRuleCommunication` 模型。
- 从 `CheckRule` 模型中删除 `snapshot_links`, `check_item_links`, `communication_links` 字段。
- 在 `CheckRule` 中新增：`execution_targets: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)` （针对 MySQL 的 JSON 列）。

- [ ] **Step 2: 调整 Schema 验证规格**
在 `app/schemas/check_rule.py` 中：
- 剔除 `snapshot_ids`, `check_item_ids`, `communication_ids` 等各种 list 字段。
- 引入新的 Validation 类型：
```python
from typing import List, Dict, Any, Optional

class ExecutionTarget(BaseModel):
    snapshot_id: int
    communications: Dict[str, List[int]]  # {"ids": [], "group_ids": []}
    check_items: Dict[str, List[int]]     # {"ids": [], "list_ids": []}

# 在 CheckRuleCreate/CheckRuleUpdate 中加入
execution_targets: List[ExecutionTarget] = []
```

- [ ] **Step 3: Commit**
```bash
git add app/models/check_result.py app/schemas/check_rule.py
git commit -m "refactor(models): replace relational mapping with execution_targets JSON"
```

---

### Task 2: 规则读写 API 梳理 (CRUD Router)

**Files:**
- Modify: `app/api/check_rules.py`

- [ ] **Step 1: 升级创建逻辑**
`create_check_rule` 接口中，移除 `CheckRuleSnapshot(...)` 这类外键写入操作，直接依赖 Schema 自动对 `CheckRule(..., execution_targets=[...])` 的原生持久化。

- [ ] **Step 2: 升级查询展现与更新逻辑**
`get_check_rule` 等接口中移除 `selectinload` 中对外键关系连表的查询。
`update_check_rule` 中去掉繁重的关联表先清空(`delete().where()`)再重新 `add` 的逻辑，转为直接合并和存入新的 `execution_targets` 数据。

- [ ] **Step 3: Commit**
```bash
git add app/api/check_rules.py
git commit -m "refactor(api): adapt check rules API to use JSON targets"
```

---

### Task 3: 资产删除防护防呆 (Deletion Guard)

**Files:**
- Modify: `app/api/communications.py` (及对应检查项和快照 API)

- [ ] **Step 1: 编写通用防护检测函数**
在内部增加检查方法逻辑：取出所有的 `check_rules`，遍历 JSON，如果用户试图删除的 ID 出现在了 `CheckRule` 对应的 `execution_targets` 相应字段中，抛出 HTTPException(status=400)。

- [ ] **Step 2: 埋入各路 DELETE Endpoint**
为通信机（`/api/v1/communications/{id}`）、检查项、快照的 DELETE 方法补充刚才的依赖检测挂载。

- [ ] **Step 3: Commit**
```bash
git add app/api/communications.py app/api/check_items.py app/api/snapshots.py
git commit -m "feat(api): add execution_targets validation on asset deletion"
```

---

### Task 4: 检查调度引流 (Execution Engine)

**Files:**
- Modify: `app/services/check_service.py`

- [ ] **Step 1: 重构执行池汇聚逻辑**
修改 `_get_flattened_communications`（或者不再扁平化），将调度中心从直接查全量机器列表，改为迭代 `rule.execution_targets`。
每次循环代表一组独立的 Target。在这个循环里，针对指定的 `snapshot_id` 和限定的部分机器调用底层比对。

- [ ] **Step 2: 测试执行生成的结果**
确认 TDD 后台发送 `POST /api/v1/check-rules/1/execute` 时能够毫无违和感地生成基于各个细分基准快照的结果任务批次。

- [ ] **Step 3: Commit**
```bash
git add app/services/check_service.py
git commit -m "refactor(engine): support routing executing tasks per target row"
```

---

### Task 5: 前端交互全量改造 (Frontend UI)

**Files:**
- Modify: `app/static/dashboard.html`
- Modify: `app/static/js/checks.js`
- Modify: `app/static/css/style.css`

- [ ] **Step 1: UI 结构替换**
在 `dashboard.html` 的 Workbench 表单中，摘除原来并列的三个 `<div class="asset-selector-card">`，替换为 `<div id="executionTargetsContainer"></div>`，并在上方提供按钮 `<button onclick="window.checks.addExecutionTarget()">+ 添加策略行</button>`。

- [ ] **Step 2: 数据结构承载与 JS 面板控制**
在 `checks.js` 中增加一个内存变体 `let currentExecutionTargets = []`。
定义好行号渲染机制：每行展示一个选择好的 Snapshot 名称，以及它下属选中的通讯机/检查项数量标识（附带编辑和删除本行小按钮）。

- [ ] **Step 3: 前端“自动填充”交互事件**
联动处理：当某一行指定完 Snapshot 后，拦截关闭瞬间发送 API 请求 `/api/v1/snapshots/{id}/details` 提取当初构建该快照关联到的通信机和检查项组合。将它们转化为默认勾选填入当前行数据集合。允许用户随后再次点击修改削减规模。

- [ ] **Step 4: 测试集成并提交**
刷新页面，模拟创建带有多行目标集的混合规则，提交保存后调取 `/execute` 执行任务以验证端到端成功！

- [ ] **Step 5: Commit**
```bash
git add app/static/
git commit -m "feat(ui): redesign workbench for dynamic multi-execution targets"
```

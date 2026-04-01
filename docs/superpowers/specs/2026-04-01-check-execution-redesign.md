# 检查执行功能重新设计

## 概述

重新设计"检查执行" Tab，从当前的简单表格+弹窗模式升级为完整的**检查规则管理 + 执行**系统。采用侧边栏+详情区的布局，与现有的通信机管理、快照管理 Tab 保持一致。

## 范围

- **包含**：检查规则 CRUD、数据模型扩展、API、前端 UI、手动执行、调度配置
- **不包含**：检查报表 Tab（保持现有）、定时任务引擎实现（仅存储 cron 配置）、报表导出

## 1. 数据模型

### 1.1 CheckRule 表扩展

现有 `check_rules` 表需要扩展以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer PK | 主键 |
| `name` | String(100) | 规则名称，唯一 |
| `description` | Text | 描述 |
| `is_active` | Boolean | 是否启用，默认 true |
| `allow_manual_execution` | Boolean | 是否允许手动执行，默认 true |
| `cron_expression` | String(100) | 定时调度表达式，可空 |
| `time_window_start` | String(5) | 有效时间窗口开始，如 "09:00"，可空 |
| `time_window_end` | String(5) | 有效时间窗口结束，如 "18:00"，可空 |
| `time_window_weekdays` | String(20) | 有效工作日，如 "1,2,3,4,5"，可空 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

**移除字段**：`check_item_list_id`、`snapshot_id`（替换为多对多关联表）

### 1.2 新增关联表

#### check_rule_snapshots（规则 ↔ 快照/快照组）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer PK | 主键 |
| `rule_id` | FK → check_rules.id | 规则 ID |
| `snapshot_id` | FK → snapshots.id | 快照 ID，可空 |
| `snapshot_group_id` | FK → snapshot_groups.id | 快照组 ID，可空 |

约束：`snapshot_id` 和 `snapshot_group_id` 必须有且仅有一个非空。

#### check_rule_check_items（规则 ↔ 检查项/检查项列表）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer PK | 主键 |
| `rule_id` | FK → check_rules.id | 规则 ID |
| `check_item_id` | FK → check_items.id | 检查项 ID，可空 |
| `check_item_list_id` | FK → check_item_lists.id | 检查项列表 ID，可空 |

约束：`check_item_id` 和 `check_item_list_id` 必须有且仅有一个非空。

#### check_rule_communications（规则 ↔ 通信机/通信机组）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer PK | 主键 |
| `rule_id` | FK → check_rules.id | 规则 ID |
| `communication_id` | FK → communications.id | 通信机 ID，可空 |
| `communication_group_id` | FK → communication_groups.id | 通信机组 ID，可空 |

约束：`communication_id` 和 `communication_group_id` 必须有且仅有一个非空。

### 1.3 ScheduledTask 表

合并到 `CheckRule` 中。现有 `scheduled_tasks` 表的功能由 `CheckRule` 的 `cron_expression`、`time_window_*` 字段替代。迁移策略：如果有已存在的 ScheduledTask 数据，迁移到对应 CheckRule。

### 1.4 CheckResult 表

保持不变。执行时通过 `rule_id` 关联，`communication_id` 指定具体通信机。

## 2. API 设计

### 2.1 检查规则 CRUD

#### GET /api/v1/check-rules

返回规则列表，包含关联摘要。

响应示例：
```json
[
  {
    "id": 1,
    "name": "每日核心检查",
    "description": "工作日凌晨自动检查核心服务器",
    "is_active": true,
    "allow_manual_execution": true,
    "cron_expression": "0 2 * * 1-5",
    "time_window_start": "00:00",
    "time_window_end": "06:00",
    "time_window_weekdays": "1,2,3,4,5",
    "snapshot_count": 2,
    "check_item_count": 5,
    "communication_count": 10,
    "created_at": "2026-04-01T10:00:00",
    "updated_at": "2026-04-01T10:00:00"
  }
]
```

#### POST /api/v1/check-rules

创建规则，包含所有关联数据。

请求体：
```json
{
  "name": "每日核心检查",
  "description": "工作日凌晨自动检查核心服务器",
  "is_active": true,
  "allow_manual_execution": true,
  "cron_expression": "0 2 * * 1-5",
  "time_window_start": "00:00",
  "time_window_end": "06:00",
  "time_window_weekdays": "1,2,3,4,5",
  "snapshot_ids": [1, 2],
  "snapshot_group_ids": [3],
  "check_item_ids": [],
  "check_item_list_ids": [1],
  "communication_ids": [5],
  "communication_group_ids": [1, 2]
}
```

#### GET /api/v1/check-rules/{id}

返回规则详情，含完整关联数据（具体的快照/检查项/通信机名称列表）。

#### PUT /api/v1/check-rules/{id}

更新规则，请求体同 POST。关联数据采用**全量替换**策略。

#### DELETE /api/v1/check-rules/{id}

删除规则。级联删除关联表数据。不删除已有的 CheckResult。

#### PATCH /api/v1/check-rules/{id}/toggle

切换 `is_active` 状态。

### 2.2 执行 API

#### POST /api/v1/check-rules/{id}/execute

手动执行规则。

逻辑：
1. 检查规则是否存在、是否 `allow_manual_execution`
2. 展开所有分组（快照组→快照列表，通信机组→通信机列表，检查项列表→检查项列表）
3. 为每台通信机创建 `CheckResult` 记录
4. 通过 Celery 触发异步执行
5. 返回创建的任务 ID 列表

响应：
```json
{
  "message": "已为 10 台通信机创建检查任务",
  "created_count": 10,
  "result_ids": [101, 102, 103, ...]
}
```

### 2.3 保留的现有 API

以下 API 保持不变，继续服务于检查报表 Tab：

- `GET /api/v1/checks` — 检查结果列表
- `GET /api/v1/checks/{id}` — 检查结果详情
- `GET /api/v1/checks/{id}/progress` — 检查进度
- `DELETE /api/v1/checks/{id}` — 取消检查
- `GET /api/v1/checks/current` — 当前任务

## 3. 前端 UI

### 3.1 布局

采用侧边栏 + 详情区的两栏布局，与通信机管理、快照管理 Tab 一致：

- **左侧侧边栏**（280px）：规则列表
  - 顶部：标题"检查规则" + "+ 新建"按钮
  - 列表项：规则名称 + 状态圆点（绿=启用/灰=禁用）+ 下次执行时间或"手动"标签
  - 选中项高亮

- **右侧内容区**：规则详情/编辑
  - 顶部：规则名称 + 操作按钮（编辑、启用/禁用、删除）
  - 基础信息区：名称、描述
  - 关联要素区：三栏并列展示快照/检查项/通信机关联
  - 调度配置区：cron 表达式、时间窗口、工作日
  - 底部操作栏：保存、执行检查、删除

### 3.2 关联要素选择

每个维度（快照、检查项、通信机）的选择交互：

- 使用弹窗（Modal），内部分两个 Tab：
  - "选择个体"：从现有项中勾选
  - "选择分组"：从现有分组中勾选
- 已选择的项显示为标签（Tag），可单独移除
- 选择后实时显示展开后的总数（如"2 个快照组 → 共 8 个快照"）

### 3.3 执行流程

1. 点击"执行检查"按钮
2. 弹出确认框：展示展开后的统计（X 台通信机 × Y 个检查项）
3. 确认后调用 `POST /api/v1/check-rules/{id}/execute`
4. 右侧顶部显示进度条（复用现有进度轮询机制）
5. 完成后显示摘要 + 链接到"检查报表"Tab

### 3.4 样式

沿用 Control Room 暗色主题，使用已有的 CSS 变量系统。所有新增组件使用 `var(--bg-*)`, `var(--border-*)`, `var(--text-*)` 等变量。

## 4. 文件变更清单

### 后端

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/models/check_result.py` | 修改 | 扩展 CheckRule 字段，新增关联模型 |
| `app/schemas/check_rule.py` | 新建 | 检查规则的 Pydantic schemas |
| `app/api/check_rules.py` | 新建 | 检查规则 CRUD + 执行 API |
| `app/api/checks.py` | 修改 | 移除旧的 start_check，保留结果查询 |
| `app/services/check_service.py` | 修改 | 新增规则执行逻辑（展开分组 → 创建任务） |
| `app/main.py` | 修改 | 注册新路由 |

### 前端

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/static/dashboard.html` | 修改 | 重写检查执行 Tab 的 HTML 结构 |
| `app/static/js/checks.js` | 重写 | 检查规则管理 + 执行的 JS 逻辑 |
| `app/static/css/style.css` | 修改 | 新增规则详情区的样式 |

### 数据库迁移

- 新增 3 个关联表
- 扩展 check_rules 表字段
- 迁移 scheduled_tasks 数据（如有）

## 5. 不做什么

- 不改检查报表 Tab
- 不实现定时任务引擎（只存储 cron 配置，引擎后续单独实现）
- 不改 CheckResult / CheckResultDetail 模型
- 不改现有的快照、检查项、通信机管理功能

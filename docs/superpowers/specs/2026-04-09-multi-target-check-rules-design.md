# 检查规则多实例混合执行架构升级方案 (Multi-Target Execution for Check Rules)

## 1. 背景与目标 (Background & Goals)
当前系统中，`CheckRule` 采用“快照”、“通信机”、“检查项”的单一并排扁平关联，这限制了检查任务的灵活性。用户期望能够在一个规则中增加多个对比组合单元（执行行），每个组合独立绑定一个基准快照，且可针对其下属的关联机器进行裁剪。同时需要支持当删除通用资产（如某台通信机）时，系统能够有效预警并拦截引用了该资产的业务规则，防止死链（幽灵任务）。

## 2. 核心数据设计 (Data Model Modifications)
- **丢弃复杂映射**：移除 `CheckRuleSnapshot`, `CheckRuleCheckItem`, `CheckRuleCommunication` 三张中间关联表的束缚。
- **引入复合字段**：在 `CheckRule` 表中新增 `execution_targets` 作为 `JSON` 列。
- **存储结构 (Target Row Data)**：
  这代表界面上保存下来的一类组合目标：
  ```json
  [
    {
      "id": "行级别唯一ID（用于前端渲染对账等，如 UUID，可选）",
      "snapshot_id": 10,
      "communications": { "ids": [1, 2], "group_ids": [] },
      "check_items": { "ids": [5, 6], "list_ids": [1] }
    }
  ]
  ```

## 3. 防呆与保护 (Safety & Constraints)
为弥补 JSON 无原生外键约束的短板，我们强化 Delete Rest 鉴权：
- **拦截生效区**：
  `DELETE /api/v1/communications/{id}`
  `DELETE /api/v1/communications/groups/{id}`
  `DELETE /api/v1/check-items/{id}`
  `DELETE /api/v1/check-items/lists/{id}`
  `DELETE /api/v1/snapshots/{id}`
- **拦截逻辑**：
  在触发数据 `db.delete()` 动作前：
  1. 通过遍历 `select(CheckRule)` 获取活跃状态和待检查的所有 JSON 值。
  2. 使用 Python 内存层解包检查 `execution_targets`。
  3. 若被测 ID 正在其中任意层级中驻留，则捕获：`HTTP 400 "该资源目前正被检查规则 【XXX】 设为执行目标配置段落中，请移步该项规则进行解绑卸载后重试。"`。

## 4. 后台执行引擎适配 (Engine Adaptation)
- **CheckExecutionService**: 提取所有 `targets` 并根据每组的 `snapshot_id` 来计算并集的机器，但对比标准是基于本 Row 内指定的快照进行的。如果机器既在基准又在靶机范围，将精准进行多批次或基于组合字典的执行指派。

## 5. UI交互重构 (UI Refactor)
- **改版点**：停用旧版的 3 格固定资产面板。
- **新结构**：一个支持动态渲染的**执行目标组合列表**。
- **交互规范**：
  1. 点击【+ 添加对比目标】加入新配置行。
  2. 用户仅需点击弹窗并必选一个基准 **快照 (Snapshot)**。
  3. 通过监听选定操作，前端调用包含关系数据的该快照基础信息，**自动在这一行内勾挂并渲染出同批次的设备与检查项**。
  4. 支持单独唤醒选中通信机的 Drawer 进行减少裁剪（支持局部调整但不污染上游资产）。

# 快照构建改进设计规范

## 1. 概述

### 1.1 目标
改进快照构建功能，实现异步执行、实时进度显示、批量构建多台通信机的能力。

### 1.2 核心概念

| 概念 | 说明 |
|------|------|
| **通信机组** | 可多层级的树形结构，包含具体通信机 |
| **检查项列表** | 一组检查项的集合 |
| **快照组** | 用于归档快照的分组 |
| **快照** | 包含多个快照实例，代表多台通信机的环境状态 |
| **快照实例** | 单个通信机的采集数据（关联检查项列表） |

## 2. 工作流

```
1. 用户输入快照名称（系统自动附加时间戳）
2. 用户选择目标快照组
3. 用户选择通信机组（支持多选）
   - 方式A：快速按组选择
   - 方式B：展开组，选择具体通信机
4. 对每个选中的组，用户手动选择关联的检查项列表
5. 点击"构建"
6. 系统为每组创建独立的快照实例，汇总到一个快照
7. 显示分组进度概览 + 通信机详情
8. 完成后刷新快照列表
```

### 2.1 命名格式
```
{用户输入名称}_{YYYYMMDDHHMM}
示例: 生产环境快照_202503251430
```

## 3. 数据模型

### 3.1 新增 SnapshotBuildTask 模型
```python
class SnapshotBuildTask(Base):
    """快照构建任务"""
    __tablename__ = "snapshot_build_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("snapshots.id", ondelete="CASCADE"),
        nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="pending")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    total_groups: Mapped[int] = mapped_column(Integer, default=0)
    completed_groups: Mapped[int] = mapped_column(Integer, default=0)
    total_communications: Mapped[int] = mapped_column(Integer, default=0)
    completed_communications: Mapped[int] = mapped_column(Integer, default=0)
    current_communication: Mapped[Optional[str]] = mapped_column(String(100))
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    start_time: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # 关联的构建配置（JSON 存储）
    build_config: Mapped[dict] = mapped_column(JSON)  # [{group_id, comm_ids, check_item_list_id}]
```

## 4. API 设计

### 4.1 端点列表

| 端点 | 方法 | 说明 |
|------|------|------|
| `/snapshots/build/start` | POST | 启动快照构建 |
| `/snapshots/build/{task_id}/progress` | GET | 获取构建进度 |
| `/snapshots/build/{task_id}` | GET | 获取构建结果 |
| `/snapshots/build/{task_id}` | DELETE | 取消构建 |
| `/snapshots/build/tasks` | GET | 获取所有构建任务状态 |

### 4.2 请求/响应格式

**POST /snapshots/build/start**
```json
{
    "snapshot_name": "生产环境快照",
    "snapshot_group_id": 1,
    "build_config": [
        {
            "group_id": 1,
            "communication_ids": [1, 2, 3],  // 可选，空表示全选
            "check_item_list_id": 1
        },
        {
            "group_id": 2,
            "communication_ids": [4, 5],
            "check_item_list_id": 2
        }
    ]
}
```

**GET /snapshots/build/{task_id}/progress**
```json
{
    "id": 1,
    "snapshot_id": 1,
    "status": "running",
    "progress": 60,
    "total_groups": 2,
    "completed_groups": 1,
    "total_communications": 5,
    "completed_communications": 3,
    "current_communication": "server-04",
    "groups_progress": [
        {
            "group_id": 1,
            "group_name": "生产环境组",
            "status": "completed",
            "progress": 100,
            "communications": [
                {"id": 1, "name": "server-01", "status": "completed"},
                {"id": 2, "name": "server-02", "status": "completed"},
                {"id": 3, "name": "server-03", "status": "completed"}
            ]
        },
        {
            "group_id": 2,
            "group_name": "预发布组",
            "status": "running",
            "progress": 50,
            "communications": [
                {"id": 4, "name": "server-04", "status": "running"},
                {"id": 5, "name": "server-05", "status": "pending"}
            ]
        }
    ]
}
```

## 5. 前端界面

### 5.1 快照构建对话框

```
┌─────────────────────────────────────────────────────────┐
│ 快照构建                                            [X] │
├─────────────────────────────────────────────────────────┤
│ 快照名称: [生产环境备份________________]                   │
│ 目标组:   [选择快照组________________▼]                     │
│                                                          │
│ 选择通信机组:                                              │
│ ┌─ 生产环境组 ────────────────────────────────────┐      │
│ │ ☑ 全选此组                                     │      │
│ │   ☑ server-01 (192.168.1.10)                 │      │
│ │   ☑ server-02 (192.168.1.11)                 │      │
│ │   ☑ server-03 (192.168.1.12)                 │      │
│ │   关联检查项列表: [Linux基础检查项___________▼] │      │
│ └────────────────────────────────────────────────┘      │
│ ┌─ 预发布组 ──────────────────────────────────────────┐     │
│ │ ☑ 全选此组                                     │      │
│ │   ☑ server-04 (192.168.2.10)                  │      │
│ │   关联检查项列表: [Nginx检查项_______________▼] │      │
│ └────────────────────────────────────────────────┘      │
│                                                          │
│ [全选所有] [清空选择]              已选: 4台, 2组         │
│                                                          │
│                            [取消]  [开始构建]            │
└─────────────────────────────────────────────────────────┘
```

### 5.2 构建进度对话框

```
┌─────────────────────────────────────────────────────────┐
│ 快照构建进度: 生产环境快照_202503251430              [X]  │
├─────────────────────────────────────────────────────────┤
│ 总体进度: ████████████░░░░░░░░░ 65% (4/6 台)           │
│                                                          │
│ ▼ 生产环境组 (1/1 完成) ✓                               │
│   • server-01 ✓ 完成                                    │
│   • server-02 ✓ 完成                                    │
│   • server-03 ✓ 完成                                    │
│                                                          │
│ ▼ 预发布组 (0/2 进行中) ████████░░░░ 66%               │
│   • server-04 ✓ 完成                                    │
│   • server-05 ████░░░░░░ 采集 /etc/hosts ...           │
│                                                          │
│                                            [取消构建]     │
└─────────────────────────────────────────────────────────┘
```

## 6. 后端实现

### 6.1 服务层

**SnapshotBuildService**
- `start_build()`: 创建构建任务和快照记录，触发 Celery 任务
- `execute_build()`: Celery 任务实际执行采集
- `get_progress()`: 获取当前进度

### 6.2 Celery 任务

**execute_snapshot_build_task**
```python
@celery_app.task(bind=True)
def execute_snapshot_build_task(self, task_id: int):
    # 1. 更新任务状态为 running
    # 2. 创建快照记录
    # 3. 遍历 build_config 中的每个组
    # 4. 对每个通信机：
    #    - SSH 连接
    #    - 按检查项列表采集数据
    #    - 保存快照实例和环境数据
    #    - 更新进度
    # 5. 更新任务状态为 completed
```

### 6.3 进度追踪

复用 `check_progress.py` 中的 Redis 进度追踪器，为每个构建任务存储：
- 总体进度
- 每组进度
- 每台通信机状态

## 7. 数据采集增强

复用 `check_executor.py` 中的采集逻辑，支持所有检查项类型：
- 文件存在性、权限、属主、属组、大小、修改时间、MD5
- 文件内容检查
- 内核参数检查
- 路由表检查


## 8. 并发控制

使用现有的 `check_lock.py` 分布式锁机制：
- 同一时间只能执行一个快照构建任务
- 构建任务与检查执行任务互斥（可选）

## 9. 错误处理

| 场景 | 处理方式 |
|------|---------|
| SSH 连接失败 | 标记该通信机失败，继续其他任务 |
| 单个检查项采集失败 | 记录错误，继续其他检查项 |
| 用户取消 | 停止执行，保留已成功的数据 |
| 任务超时 | 自动标记失败，清理临时数据 |

## 10. 文件清单

### 新增文件
- `app/services/snapshot_build_service.py` - 快照构建服务
- `app/tasks/snapshot_build_tasks.py` - Celery 构建任务
- `app/schemas/snapshot_build.py` - 构建相关 Schema

### 修改文件
- `app/models/snapshot.py` - 新增 SnapshotBuildTask 模型
- `app/api/snapshots.py` - 新增构建相关 API
- `app/static/js/snapshots.js` - 添加构建对话框和进度显示
- `app/static/dashboard.html` - 添加构建按钮和对话框

## 11. 验证方案

### 单元测试
```bash
pytest tests/unit/test_snapshot_build.py -v
```

### 集成测试
```bash
pytest tests/integration/test_snapshot_build_api.py -v
```

### 手动测试
1. 选择通信机组和检查项列表
2. 启动构建，观察进度
3. 验证快照和实例正确创建
4. 测试取消功能
5. 测试错误场景（连接失败）

# 快照构建改进实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现异步快照构建功能，支持批量构建多台通信机、实时进度显示、进度追踪。

**Architecture:** 使用 Celery 异步任务处理快照构建，复用 Redis 进度追踪器，实现分组进度和通信机级别的详细进度展示。

**Tech Stack:** FastAPI + SQLAlchemy + Celery + Redis + Paramiko

---

## 文件结构

```
新增:
- app/models/snapshot.py (修改) - 新增 SnapshotBuildTask 模型
- app/services/snapshot_build_service.py - 快照构建服务
- app/services/snapshot_progress.py - 构建进度追踪器
- app/tasks/snapshot_build_tasks.py - Celery 构建任务
- app/schemas/snapshot_build.py - 构建相关 Schema
修改:
- app/api/snapshots.py - 新增构建相关 API
- app/static/js/snapshots.js - 添加构建对话框和进度显示
- app/static/dashboard.html - 添加构建按钮和对话框
```

---

## 任务分解

### Task 1: 数据模型 - 新增 SnapshotBuildTask

**Files:**
- Modify: `app/models/snapshot.py` (末尾添加)

- [ ] **Step 1: 添加 SnapshotBuildTask 模型**

在 `app/models/snapshot.py` 文件末尾添加：

```python
class SnapshotBuildTask(Base):
    """快照构建任务"""
    __tablename__ = "snapshot_build_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
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
    current_communication: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    build_config: Mapped[dict] = mapped_column(JSON, default=dict)

    snapshot: Mapped["Snapshot"] = relationship(
        "Snapshot",
        back_populates="build_tasks"
    )
```

- [ ] **Step 2: 更新 Snapshot 模型关联**

在 `app/models/snapshot.py` 的 Snapshot 类中添加：
```python
build_tasks: Mapped[list["SnapshotBuildTask"]] = relationship(
    "SnapshotBuildTask",
    back_populates="snapshot",
    cascade="all, delete-orphan"
)
```

- [ ] **Step 3: 更新 models/__init__.py 导出**

确保 `SnapshotBuildTask` 被正确导出。

Run: `grep -n "SnapshotBuildTask" app/models/__init__.py`
Expected: 应能找到导出语句

---

### Task 2: Schema 定义

**Files:**
- Create: `app/schemas/snapshot_build.py`

- [ ] **Step 1: 创建 Schema 文件**

```python
# app/schemas/snapshot_build.py
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class BuildGroupConfig(BaseModel):
    """构建组配置"""
    group_id: int
    communication_ids: Optional[List[int]] = None  # 空表示全选
    check_item_list_id: int


class StartBuildRequest(BaseModel):
    """启动构建请求"""
    snapshot_name: str
    snapshot_group_id: int
    build_config: List[BuildGroupConfig]


class CommunicationProgress(BaseModel):
    """通信机进度"""
    id: int
    name: str
    status: str  # pending, running, success, failed


class GroupProgress(BaseModel):
    """组进度"""
    group_id: int
    group_name: str
    status: str
    progress: int
    communications: List[CommunicationProgress]


class BuildProgressResponse(BaseModel):
    """构建进度响应"""
    id: int
    snapshot_id: int
    status: str
    progress: int
    total_groups: int
    completed_groups: int
    total_communications: int
    completed_communications: int
    current_communication: Optional[str] = None
    groups_progress: List[GroupProgress] = []
    error_message: Optional[str] = None


class StartBuildResponse(BaseModel):
    """启动构建响应"""
    task_id: int
    snapshot_id: int
    snapshot_name: str
    status: str
    message: str = "构建任务已创建"
```

---

### Task 3: 进度追踪器

**Files:**
- Create: `app/services/snapshot_progress.py`

- [ ] **Step 1: 创建进度追踪器**

```python
# app/services/snapshot_progress.py
import json
from typing import Optional, Dict, Any

import redis.asyncio as redis
from app.config import settings


class SnapshotBuildProgressTracker:
    """快照构建进度追踪器"""

    PROGRESS_KEY_PREFIX = "ev_check:snapshot_build:"

    def __init__(self):
        self._redis: Optional[redis.Redis] = None

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
        return self._redis

    def _key(self, task_id: int, suffix: str = "") -> str:
        return f"{self.PROGRESS_KEY_PREFIX}{task_id}{suffix}"

    async def set_initial_progress(
        self,
        task_id: int,
        total_groups: int,
        total_communications: int,
        groups_config: list
    ) -> None:
        """设置初始进度"""
        r = await self._get_redis()
        data = {
            "task_id": task_id,
            "status": "pending",
            "progress": 0,
            "total_groups": total_groups,
            "completed_groups": 0,
            "total_communications": total_communications,
            "completed_communications": 0,
            "current_communication": None,
            "groups_progress": groups_config,
        }
        await r.set(self._key(task_id), json.dumps(data), ex=7200)

    async def update_progress(
        self,
        task_id: int,
        completed_communications: int,
        completed_groups: int,
        current_communication: Optional[str] = None,
        status: str = "running"
    ) -> None:
        """更新进度"""
        r = await self._get_redis()
        data_str = await r.get(self._key(task_id))
        if data_str:
            data = json.loads(data_str)
        else:
            return

        data["completed_communications"] = completed_communications
        data["completed_groups"] = completed_groups
        data["current_communication"] = current_communication
        data["status"] = status

        # 计算总进度
        if data["total_communications"] > 0:
            data["progress"] = int(
                (completed_communications / data["total_communications"]) * 100
            )

        await r.set(self._key(task_id), json.dumps(data), ex=7200)

    async def update_group_status(
        self,
        task_id: int,
        group_id: int,
        status: str,
        communications: list
    ) -> None:
        """更新组状态"""
        r = await self._get_redis()
        data_str = await r.get(self._key(task_id))
        if data_str:
            data = json.loads(data_str)
            for group in data.get("groups_progress", []):
                if group["group_id"] == group_id:
                    group["status"] = status
                    group["communications"] = communications
                    break
            await r.set(self._key(task_id), json.dumps(data), ex=7200)

    async def get_progress(self, task_id: int) -> Optional[Dict[str, Any]]:
        """获取进度"""
        r = await self._get_redis()
        data_str = await r.get(self._key(task_id))
        if data_str:
            return json.loads(data_str)
        return None

    async def clear_progress(self, task_id: int) -> None:
        """清除进度"""
        r = await self._get_redis()
        await r.delete(self._key(task_id))

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()
            self._redis = None


# 全局单例
_progress_tracker: Optional[SnapshotBuildProgressTracker] = None


def get_snapshot_progress_tracker() -> SnapshotBuildProgressTracker:
    global _progress_tracker
    if _progress_tracker is None:
        _progress_tracker = SnapshotBuildProgressTracker()
    return _progress_tracker
```

---

### Task 4: 快照构建服务

**Files:**
- Create: `app/services/snapshot_build_service.py`

- [ ] **Step 1: 创建构建服务**

```python
# app/services/snapshot_build_service.py
from datetime import datetime
from typing import Optional, Dict, Any, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Snapshot, SnapshotGroup, SnapshotInstance, EnvironmentData,
    SnapshotBuildTask, Communication, CheckItem
)
from app.models.check_item import CheckItemList
from app.services.check_executor import execute_check
from app.services.snapshot_progress import get_snapshot_progress_tracker
from app.utils.ssh_client import SSHClientWrapper


class SnapshotBuildError(Exception):
    """快照构建错误"""
    pass


class SnapshotBuildService:
    """快照构建服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.progress_tracker = get_snapshot_progress_tracker()

    async def start_build(
        self,
        snapshot_name: str,
        snapshot_group_id: int,
        build_config: List[Dict],
    ) -> SnapshotBuildTask:
        """
        启动快照构建

        Args:
            snapshot_name: 用户输入的名称
            snapshot_group_id: 目标快照组ID
            build_config: 构建配置列表

        Returns:
            SnapshotBuildTask: 构建任务
        """
        # 1. 验证快照组存在
        group = await self._get_snapshot_group(snapshot_group_id)
        if not group:
            raise SnapshotBuildError(f"快照组不存在: {snapshot_group_id}")

        # 2. 计算总通信机数和组数
        total_communications = 0
        groups_config = []
        for config in build_config:
            comm_ids = config.get("communication_ids")
            comms = await self._get_group_communications(
                config["group_id"],
                comm_ids
            )
            total_communications += len(comms)
            groups_config.append({
                "group_id": config["group_id"],
                "group_name": comms[0].group.name if comms else "Unknown",
                "status": "pending",
                "progress": 0,
                "communications": [
                    {"id": c.id, "name": c.name, "status": "pending"}
                    for c in comms
                ]
            })

        # 3. 生成快照名称（附加时间戳）
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M")
        full_name = f"{snapshot_name}_{timestamp}"

        # 4. 创建快照记录
        snapshot = Snapshot(
            group_id=snapshot_group_id,
            name=full_name,
            snapshot_time=datetime.utcnow(),
            is_default=False,
        )
        self.db.add(snapshot)
        await self.db.flush()

        # 5. 创建构建任务
        task = SnapshotBuildTask(
            snapshot_id=snapshot.id,
            status="pending",
            progress=0,
            total_groups=len(build_config),
            completed_groups=0,
            total_communications=total_communications,
            completed_communications=0,
            start_time=datetime.utcnow(),
            build_config=build_config,
        )
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)

        # 6. 初始化进度追踪
        await self.progress_tracker.set_initial_progress(
            task_id=task.id,
            total_groups=len(build_config),
            total_communications=total_communications,
            groups_config=groups_config,
        )

        return task

    async def execute_build(self, task_id: int) -> SnapshotBuildTask:
        """
        执行快照构建（由 Celery 调用）

        Args:
            task_id: 任务ID

        Returns:
            SnapshotBuildTask: 更新后的任务
        """
        # 1. 获取任务
        task = await self._get_build_task(task_id)
        if not task:
            raise SnapshotBuildError(f"构建任务不存在: {task_id}")

        # 2. 更新状态为运行中
        task.status = "running"
        await self.db.commit()
        await self.progress_tracker.update_progress(
            task_id, 0, 0, status="running"
        )

        try:
            completed_comm = 0
            completed_groups = 0

            # 3. 遍历每个组
            for config in task.build_config:
                group_id = config["group_id"]
                comm_ids = config.get("communication_ids")
                check_list_id = config["check_item_list_id"]

                # 获取通信机列表
                comms = await self._get_group_communications(group_id, comm_ids)

                # 获取检查项列表
                check_items = await self._get_check_items(check_list_id)

                # 获取组内通信机进度索引
                comms_progress = []
                for c in comms:
                    comms_progress.append({
                        "id": c.id,
                        "name": c.name,
                        "status": "pending"
                    })

                await self.progress_tracker.update_group_status(
                    task_id, group_id, "running", comms_progress
                )

                group_success = True

                # 4. 遍历每台通信机
                for idx, comm in enumerate(comms):
                    # 更新当前通信机
                    comms_progress[idx]["status"] = "running"
                    await self.progress_tracker.update_group_status(
                        task_id, group_id, "running", comms_progress
                    )
                    await self.progress_tracker.update_progress(
                        task_id, completed_comm, completed_groups,
                        current_communication=comm.name, status="running"
                    )

                    try:
                        # SSH 连接
                        ssh_client = await self._create_ssh_client(comm)
                        connected = await ssh_client.connect()
                        if not connected:
                            comms_progress[idx]["status"] = "failed"
                            await self.progress_tracker.update_group_status(
                                task_id, group_id, "running", comms_progress
                            )
                            await ssh_client.close()
                            continue

                        # 创建快照实例
                        instance = SnapshotInstance(
                            snapshot_id=task.snapshot_id,
                            communication_id=comm.id,
                            check_item_list_id=check_list_id,
                        )
                        self.db.add(instance)
                        await self.db.flush()

                        # 采集数据
                        for item in check_items:
                            item_dict = {
                                "id": item.id,
                                "name": item.name,
                                "type": item.type,
                                "target_path": item.target_path,
                                "check_attributes": item.check_attributes,
                            }

                            result = await execute_check(ssh_client, item_dict, None)

                            # 保存环境数据（只保存实际值，不做对比）
                            env_data = EnvironmentData(
                                snapshot_instance_id=instance.id,
                                check_item_id=item.id,
                                data_value=result.actual_value or {},
                            )
                            self.db.add(env_data)

                        await self.db.commit()
                        await ssh_client.close()

                        comms_progress[idx]["status"] = "success"

                    except Exception as e:
                        comms_progress[idx]["status"] = "failed"
                        group_success = False

                    # 更新进度
                    completed_comm += 1
                    await self.progress_tracker.update_progress(
                        task_id, completed_comm, completed_groups,
                        current_communication=None, status="running"
                    )
                    await self.progress_tracker.update_group_status(
                        task_id, group_id, "running", comms_progress
                    )

                # 组完成
                if group_success:
                    completed_groups += 1
                    await self.progress_tracker.update_group_status(
                        task_id, group_id, "completed", comms_progress
                    )

            # 5. 完成
            await self.progress_tracker.update_progress(
                task_id, completed_comm, completed_groups,
                status="completed"
            )
            task.status = "completed"
            task.progress = 100
            task.completed_groups = completed_groups
            task.completed_communications = completed_comm
            task.end_time = datetime.utcnow()
            await self.db.commit()

            return task

        except Exception as e:
            task.status = "failed"
            task.error_message = str(e)
            task.end_time = datetime.utcnow()
            await self.db.commit()
            await self.progress_tracker.update_progress(
                task_id, task.completed_communications, task.completed_groups,
                status="failed"
            )
            raise SnapshotBuildError(f"构建失败: {str(e)}")

    async def get_progress(self, task_id: int) -> Optional[Dict[str, Any]]:
        """获取构建进度"""
        return await self.progress_tracker.get_progress(task_id)

    async def cancel_build(self, task_id: int) -> bool:
        """取消构建"""
        task = await self._get_build_task(task_id)
        if not task:
            return False

        if task.status in ["pending", "running"]:
            task.status = "cancelled"
            task.end_time = datetime.utcnow()
            await self.db.commit()
            await self.progress_tracker.update_progress(
                task_id, task.completed_communications, task.completed_groups,
                status="cancelled"
            )
            return True
        return False

    # ========== 私有方法 ==========

    async def _get_snapshot_group(self, group_id: int) -> Optional[SnapshotGroup]:
        result = await self.db.execute(
            select(SnapshotGroup).where(SnapshotGroup.id == group_id)
        )
        return result.scalar_one_or_none()

    async def _get_build_task(self, task_id: int) -> Optional[SnapshotBuildTask]:
        result = await self.db.execute(
            select(SnapshotBuildTask).where(SnapshotBuildTask.id == task_id)
        )
        return result.scalar_one_or_none()

    async def _get_group_communications(
        self,
        group_id: int,
        comm_ids: Optional[List[int]] = None
    ) -> List[Communication]:
        query = select(Communication).where(Communication.group_id == group_id)
        if comm_ids:
            query = query.where(Communication.id.in_(comm_ids))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _get_check_items(self, list_id: int) -> List[CheckItem]:
        result = await self.db.execute(
            select(CheckItem).where(CheckItem.list_id == list_id)
        )
        return list(result.scalars().all())

    async def _create_ssh_client(self, comm: Communication) -> SSHClientWrapper:
        return SSHClientWrapper(
            host=comm.ip_address,
            port=comm.port or 22,
            username=comm.username or "root",
            password=comm.password,
            private_key_path=comm.private_key_path,
        )
```

---

### Task 5: Celery 任务

**Files:**
- Create: `app/tasks/snapshot_build_tasks.py`

- [ ] **Step 1: 创建 Celery 任务**

```python
# app/tasks/snapshot_build_tasks.py
from celery import Task

from app.celery_config import celery_app
from app.database import async_session_maker
from app.services.snapshot_build_service import SnapshotBuildService, SnapshotBuildError


class SnapshotBuildCallback(Task):
    """快照构建任务回调"""

    def on_success(self, retval, task_id, args, kwargs):
        print(f"快照构建任务 {task_id} 成功完成: {retval}")

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        print(f"快照构建任务 {task_id} 失败: {exc}")


def run_build(task_id: int):
    """执行快照构建的同步包装"""
    import asyncio
    import traceback

    async def _execute():
        async with async_session_maker() as db:
            service = SnapshotBuildService(db)
            try:
                result = await service.execute_build(task_id)
                return {
                    "status": "success",
                    "task_id": result.id,
                    "snapshot_id": result.snapshot_id,
                    "message": f"构建完成，状态: {result.status}",
                }
            except SnapshotBuildError as e:
                return {
                    "status": "error",
                    "task_id": task_id,
                    "message": str(e),
                }
            except Exception as e:
                traceback.print_exc()
                return {
                    "status": "error",
                    "task_id": task_id,
                    "message": f"构建异常: {str(e)}",
                }

    return asyncio.run(_execute())


@celery_app.task(
    bind=True,
    base=SnapshotBuildCallback,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3, "countdown": 60},
    soft_time_limit=7200,  # 2小时软限制
    time_limit=7800,  # 2小时10分钟硬限制
)
def execute_snapshot_build_task(self, task_id: int):
    """执行快照构建任务"""
    return run_build(task_id)
```

---

### Task 6: API 端点

**Files:**
- Modify: `app/api/snapshots.py`

- [ ] **Step 1: 添加 API 端点**

在 `app/api/snapshots.py` 中添加以下端点（在文件末尾添加）：

```python
# ========== 快照构建 API ==========

from app.schemas.snapshot_build import (
    StartBuildRequest,
    StartBuildResponse,
    BuildProgressResponse,
    GroupProgress,
    CommunicationProgress,
)
from app.services.snapshot_build_service import SnapshotBuildService, SnapshotBuildError
from app.services.snapshot_progress import get_snapshot_progress_tracker
from app.tasks.snapshot_build_tasks import execute_snapshot_build_task


@router.post("/build/start", response_model=StartBuildResponse, status_code=status.HTTP_201_CREATED)
async def start_snapshot_build(
    request: StartBuildRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """启动快照构建"""
    service = SnapshotBuildService(db)

    try:
        task = await service.start_build(
            snapshot_name=request.snapshot_name,
            snapshot_group_id=request.snapshot_group_id,
            build_config=[c.model_dump() for c in request.build_config],
        )

        # 触发 Celery 任务
        execute_snapshot_build_task.delay(task_id=task.id)

        return StartBuildResponse(
            task_id=task.id,
            snapshot_id=task.snapshot_id,
            snapshot_name=task.snapshot.name,
            status=task.status,
            message="构建任务已创建",
        )

    except SnapshotBuildError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/build/{task_id}/progress", response_model=BuildProgressResponse)
async def get_build_progress(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取构建进度"""
    from app.models import SnapshotBuildTask

    # 从数据库获取基本信息
    result = await db.execute(
        select(SnapshotBuildTask).where(SnapshotBuildTask.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="构建任务不存在")

    # 从 Redis 获取详细进度
    tracker = get_snapshot_progress_tracker()
    progress = await tracker.get_progress(task_id)

    # 构建响应
    groups_progress = []
    if progress and "groups_progress" in progress:
        for g in progress["groups_progress"]:
            comms = [
                CommunicationProgress(**c)
                for c in g.get("communications", [])
            ]
            groups_progress.append(GroupProgress(
                group_id=g["group_id"],
                group_name=g.get("group_name", ""),
                status=g.get("status", "pending"),
                progress=g.get("progress", 0),
                communications=comms,
            ))

    return BuildProgressResponse(
        id=task.id,
        snapshot_id=task.snapshot_id,
        status=task.status,
        progress=task.progress,
        total_groups=task.total_groups,
        completed_groups=task.completed_groups,
        total_communications=task.total_communications,
        completed_communications=task.completed_communications,
        current_communication=task.current_communication,
        groups_progress=groups_progress,
        error_message=task.error_message,
    )


@router.delete("/build/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_snapshot_build(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """取消快照构建"""
    service = SnapshotBuildService(db)
    cancelled = await service.cancel_build(task_id)

    if not cancelled:
        raise HTTPException(
            status_code=400,
            detail="无法取消构建任务（任务可能已结束）"
        )
```

- [ ] **Step 2: 确保模型导入**

确保文件顶部有 `SnapshotBuildTask` 的导入。

---

### Task 7: 前端 - 快照构建对话框

**Files:**
- Modify: `app/static/js/snapshots.js`
- Modify: `app/static/dashboard.html`

- [ ] **Step 1: 在 snapshots.js 添加构建相关函数**

在 `window.snapshots` 对象中添加：

```javascript
// 快照构建相关

// 打开构建对话框
function openSnapshotBuildModal() {
    document.getElementById('buildSnapshotName').value = '';
    loadSnapshotGroupsForBuild();
    loadCommunicationGroupsTree();
    document.getElementById('snapshotBuildModal').classList.add('active');
}

function closeSnapshotBuildModal() {
    document.getElementById('snapshotBuildModal').classList.remove('active');
    if (window.buildProgressInterval) {
        clearInterval(window.buildProgressInterval);
        window.buildProgressInterval = null;
    }
}

// 加载快照组到构建对话框
async function loadSnapshotGroupsForBuild() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/snapshots/groups`, { headers: getHeaders() });
        const groups = await res.json();
        const select = document.getElementById('buildSnapshotGroup');
        select.innerHTML = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 加载通信机组树形结构
async function loadCommunicationGroupsTree() {
    try {
        // 获取通信机组树
        const groupsRes = await fetch(`${API_BASE}/api/v1/communications/groups`, { headers: getHeaders() });
        const groups = await groupsRes.json();

        // 获取所有通信机
        const commsRes = await fetch(`${API_BASE}/api/v1/communications`, { headers: getHeaders() });
        const comms = await commsRes.json();

        // 获取检查项列表
        const listsRes = await fetch(`${API_BASE}/api/v1/check-items/lists`, { headers: getHeaders() });
        const lists = await listsRes.json();

        // 构建树形HTML
        const container = document.getElementById('commGroupTree');
        let html = '';

        for (const group of groups) {
            const groupComms = comms.filter(c => c.group_id === group.id);
            html += `
                <div class="build-group-item" data-group-id="${group.id}">
                    <div class="group-header">
                        <input type="checkbox" class="group-select-all" onchange="toggleGroupSelection(${group.id}, this.checked)">
                        <span class="group-toggle" onclick="toggleGroupExpand(${group.id})">▼</span>
                        <span class="group-name">${group.name}</span>
                    </div>
                    <div class="group-communications" id="group-comms-${group.id}" style="display:none;">
                        ${groupComms.map(c => `
                            <label class="comm-item">
                                <input type="checkbox" name="buildCommIds" value="${c.id}" data-group-id="${group.id}" onchange="updateBuildSelection()">
                                <span>${c.name} (${c.ip_address})</span>
                            </label>
                        `).join('')}
                        <div class="check-list-selector">
                            <label>关联检查项列表:</label>
                            <select name="checkListId" data-group-id="${group.id}">
                                ${lists.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
        updateBuildSelection();
    } catch (e) { console.error(e); }
}

function toggleGroupExpand(groupId) {
    const el = document.getElementById(`group-comms-${groupId}`);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function toggleGroupSelection(groupId, checked) {
    document.querySelectorAll(`input[name="buildCommIds"][data-group-id="${groupId}"]`).forEach(cb => {
        cb.checked = checked;
    });
    updateBuildSelection();
}

function updateBuildSelection() {
    const checked = document.querySelectorAll('input[name="buildCommIds"]:checked');
    const groups = new Set([...checked].map(cb => cb.dataset.groupId));
    document.getElementById('buildSelectionCount').textContent = `已选: ${checked.length}台, ${groups.size}组`;
}

function getBuildConfig() {
    const groups = {};

    document.querySelectorAll('input[name="buildCommIds"]:checked').forEach(cb => {
        const groupId = cb.dataset.groupId;
        if (!groups[groupId]) {
            groups[groupId] = [];
        }
        groups[groupId].push(parseInt(cb.value));
    });

    return Object.entries(groups).map(([groupId, commIds]) => {
        const select = document.querySelector(`select[name="checkListId"][data-group-id="${groupId}"]`);
        return {
            group_id: parseInt(groupId),
            communication_ids: commIds,
            check_item_list_id: parseInt(select.value),
        };
    });
}

// 开始构建
async function startSnapshotBuild() {
    const name = document.getElementById('buildSnapshotName').value.trim();
    const groupId = document.getElementById('buildSnapshotGroup').value;

    if (!name) { alert('请输入快照名称'); return; }
    if (!groupId) { alert('请选择快照组'); return; }

    const config = getBuildConfig();
    if (config.length === 0) { alert('请选择至少一台通信机'); return; }

    try {
        const res = await fetch(`${API_BASE}/api/v1/snapshots/build/start`, {
            method: 'POST',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                snapshot_name: name,
                snapshot_group_id: parseInt(groupId),
                build_config: config,
            })
        });

        if (!res.ok) {
            const err = await res.json();
            alert('启动失败: ' + (err.detail || err.message));
            return;
        }

        const data = await res.json();
        closeSnapshotBuildModal();
        showBuildProgress(data.task_id, data.snapshot_name);

    } catch (e) {
        console.error(e);
        alert('启动失败: ' + e.message);
    }
}

// 显示构建进度
function showBuildProgress(taskId, snapshotName) {
    document.getElementById('buildProgressName').textContent = snapshotName;
    document.getElementById('snapshotBuildProgressModal').classList.add('active');
    pollBuildProgress(taskId);
    window.buildProgressInterval = setInterval(() => pollBuildProgress(taskId), 2000);
}

async function pollBuildProgress(taskId) {
    try {
        const res = await fetch(`${API_BASE}/api/v1/snapshots/build/${taskId}/progress`, { headers: getHeaders() });
        const data = await res.json();

        // 更新总体进度
        document.getElementById('buildOverallProgress').style.width = data.progress + '%';
        document.getElementById('buildProgressText').textContent =
            `${data.progress}% (${data.completed_communications}/${data.total_communications} 台)`;

        // 更新分组进度
        const container = document.getElementById('buildGroupsProgress');
        let html = '';
        for (const group of data.groups_progress || []) {
            html += `
                <div class="build-group-progress">
                    <div class="group-title">
                        <span class="group-toggle" onclick="toggleGroupProgress(this)">▶</span>
                        <span>${group.group_name} (${group.communications.filter(c => c.status === 'success').length}/${group.communications.length})</span>
                        <span class="status-${group.status}">${group.status === 'completed' ? '✓ 完成' : group.status === 'running' ? '进行中' : group.status}</span>
                    </div>
                    <div class="group-comm-progress" style="display:none;">
                        ${group.communications.map(c => `
                            <div class="comm-progress-item">
                                <span class="comm-status-${c.status}">${c.status === 'success' ? '✓' : c.status === 'running' ? '▸' : c.status === 'failed' ? '✗' : '○'}</span>
                                <span>${c.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;

        // 检查是否完成
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
            clearInterval(window.buildProgressInterval);
            if (data.status === 'completed') {
                alert('快照构建完成！');
            }
        }
    } catch (e) { console.error(e); }
}

function toggleGroupProgress(el) {
    const progress = el.parentElement.nextElementSibling;
    progress.style.display = progress.style.display === 'none' ? 'block' : 'none';
    el.textContent = progress.style.display === 'none' ? '▶' : '▼';
}

// 取消构建
async function cancelSnapshotBuild(taskId) {
    if (!confirm('确定取消构建？')) return;
    try {
        await fetch(`${API_BASE}/api/v1/snapshots/build/${taskId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        clearInterval(window.buildProgressInterval);
        closeSnapshotBuildModal();
        alert('构建已取消');
    } catch (e) { console.error(e); }
}

function closeBuildProgressModal() {
    document.getElementById('snapshotBuildProgressModal').classList.remove('active');
    if (window.buildProgressInterval) {
        clearInterval(window.buildProgressInterval);
        window.buildProgressInterval = null;
    }
}
```

- [ ] **Step 2: 添加构建按钮和对话框 HTML**

在 `dashboard.html` 中找到快照管理区域，添加构建按钮：

```html
<!-- 在快照列表的操作栏添加构建按钮 -->
<button class="btn btn-success" onclick="openSnapshotBuildModal()">构建快照</button>
```

添加构建对话框（在 `snapshotModal` 后添加）：

```html
<!-- 快照构建对话框 -->
<div class="modal" id="snapshotBuildModal">
    <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
            <h3>快照构建</h3>
            <button class="modal-close" onclick="closeSnapshotBuildModal()">&times;</button>
        </div>
        <form id="snapshotBuildForm">
            <div class="form-group">
                <label>快照名称 *</label>
                <input type="text" id="buildSnapshotName" placeholder="输入快照名称，系统将自动附加时间戳" required>
            </div>
            <div class="form-group">
                <label>目标快照组 *</label>
                <select id="buildSnapshotGroup" required></select>
            </div>
            <div class="form-group">
                <label>选择通信机组</label>
                <div id="commGroupTree" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 6px;"></div>
            </div>
            <div id="buildSelectionCount" style="margin: 10px 0; color: #666;">已选: 0台, 0组</div>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button type="button" class="btn btn-primary" style="flex:1;" onclick="startSnapshotBuild()">开始构建</button>
                <button type="button" class="btn btn-default" style="flex:1;" onclick="closeSnapshotBuildModal()">取消</button>
            </div>
        </form>
    </div>
</div>

<!-- 构建进度对话框 -->
<div class="modal" id="snapshotBuildProgressModal">
    <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
            <h3>快照构建进度: <span id="buildProgressName"></span></h3>
            <button class="modal-close" onclick="closeBuildProgressModal()">&times;</button>
        </div>
        <div>
            <div style="margin-bottom:15px;">
                <div>总体进度: <span id="buildProgressText"></span></div>
                <div class="progress-bar" style="height:20px; background:#eee; border-radius:10px; overflow:hidden;">
                    <div id="buildOverallProgress" style="height:100%; background:#52c41a; width:0%; transition:width 0.3s;"></div>
                </div>
            </div>
            <div id="buildGroupsProgress"></div>
            <div style="margin-top:20px; text-align:right;">
                <button class="btn btn-danger" onclick="cancelSnapshotBuild()">取消构建</button>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 3: 添加构建相关的 CSS 样式**

在 dashboard.html 的 `<style>` 中添加：

```css
/* 快照构建样式 */
.build-group-item {
    margin-bottom: 10px;
    border: 1px solid #eee;
    border-radius: 6px;
    overflow: hidden;
}
.build-group-item .group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f5f7fa;
    cursor: pointer;
}
.build-group-item .group-header:hover {
    background: #e6f7ff;
}
.build-group-item .group-name {
    flex: 1;
    font-weight: 500;
}
.build-group-item .group-communications {
    padding: 10px 12px 10px 36px;
}
.build-group-item .comm-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    cursor: pointer;
}
.build-group-item .check-list-selector {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed #ddd;
    display: flex;
    align-items: center;
    gap: 8px;
}
.build-group-item .check-list-selector select {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

/* 进度显示样式 */
.build-group-progress {
    margin-bottom: 10px;
    border: 1px solid #eee;
    border-radius: 6px;
    overflow: hidden;
}
.build-group-progress .group-title {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #fafafa;
    cursor: pointer;
}
.build-group-progress .group-comm-progress {
    padding: 8px 12px 8px 32px;
}
.build-group-progress .comm-progress-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 13px;
}
.comm-status-success { color: #52c41a; }
.comm-status-running { color: #1890ff; }
.comm-status-failed { color: #f5222d; }
.comm-status-pending { color: #999; }
.status-completed { color: #52c41a; }
.status-running { color: #1890ff; }
.status-failed { color: #f5222d; }
```

---

### Task 8: 模型导出

**Files:**
- Modify: `app/models/__init__.py`

- [ ] **Step 1: 确保 SnapshotBuildTask 被导出**

检查 `app/models/__init__.py` 是否包含 SnapshotBuildTask 的导出。如果没有，添加：

```python
from app.models.snapshot import SnapshotGroup, Snapshot, SnapshotInstance, EnvironmentData, SnapshotBuildTask
```

---

## 验证方案

### 单元测试
```bash
pytest tests/unit/test_snapshot_build.py -v
```

### 集成测试
```bash
pytest tests/integration/test_snapshot_build_api.py -v
```

### 手动测试步骤
1. 启动服务：`uvicorn app.main:app --reload`
2. 启动 Celery：`celery -A app.celery_config worker --loglevel=info`
3. 访问 `http://localhost:8000/dashboard.html`
4. 进入"快照管理"标签页
5. 点击"构建快照"按钮
6. 填写快照名称，选择快照组
7. 展开通信机组，选择通信机
8. 为每个组选择检查项列表
9. 点击"开始构建"
10. 观察进度对话框中的分组和通信机进度
11. 验证完成后快照和实例正确创建

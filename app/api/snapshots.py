# 快照管理 API
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, SnapshotGroup, Snapshot, SnapshotInstance, EnvironmentData, Communication
from app.models.check_item import CheckItem, CheckItemList
from app.models.check_result import CheckRule
from app.models.snapshot import SnapshotBuildTask
from app.api.users import get_current_active_user
from app.utils.ssh_client import SSHClientWrapper
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

router = APIRouter()


@router.get("/groups", response_model=List[dict])
async def list_snapshot_groups(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取快照组列表"""
    result = await db.execute(select(SnapshotGroup).offset(skip).limit(limit))
    groups = result.scalars().all()
    return [
        {
            "id": g.id,
            "name": g.name,
            "parent_id": g.parent_id,
            "check_item_list_id": g.check_item_list_id,
            "default_snapshot_id": g.default_snapshot_id,
            "is_system": g.is_system,
            "description": g.description,
            "created_at": g.created_at.isoformat(),
            "updated_at": g.updated_at.isoformat(),
        }
        for g in groups
    ]


@router.get("/groups/tree", response_model=List[dict])
async def get_snapshot_group_tree(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取快照组树形结构"""
    # 获取所有快照组
    result = await db.execute(select(SnapshotGroup))
    groups = result.scalars().all()
    
    # 构建树形结构
    group_map = {g.id: g for g in groups}
    tree = []
    
    def build_tree(group_id):
        group = group_map.get(group_id)
        if not group:
            return None
        
        children = [build_tree(child.id) for child in group.children]
        children = [child for child in children if child]
        
        return {
            "id": group.id,
            "name": group.name,
            "parent_id": group.parent_id,
            "check_item_list_id": group.check_item_list_id,
            "default_snapshot_id": group.default_snapshot_id,
            "is_system": group.is_system,
            "description": group.description,
            "children": children,
        }
    
    # 从根节点开始构建
    for group in groups:
        if group.parent_id is None:
            tree_node = build_tree(group.id)
            if tree_node:
                tree.append(tree_node)
    
    return tree


@router.post("/groups", status_code=status.HTTP_201_CREATED)
async def create_snapshot_group(
    group: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """创建快照组"""
    db_group = SnapshotGroup(
        name=group["name"],
        parent_id=group.get("parent_id"),
        check_item_list_id=group.get("check_item_list_id"),
        is_system=group.get("is_system", False),
        description=group.get("description"),
    )
    db.add(db_group)
    await db.commit()
    await db.refresh(db_group)
    return {"id": db_group.id, "name": db_group.name}


@router.get("/groups/{group_id}")
async def get_snapshot_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取快照组详情"""
    result = await db.execute(select(SnapshotGroup).where(SnapshotGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="快照组不存在")
    return {
        "id": group.id,
        "name": group.name,
        "parent_id": group.parent_id,
        "check_item_list_id": group.check_item_list_id,
        "default_snapshot_id": group.default_snapshot_id,
        "is_system": group.is_system,
        "description": group.description,
    }


@router.put("/groups/{group_id}")
async def update_snapshot_group(
    group_id: int,
    group: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """更新快照组"""
    result = await db.execute(select(SnapshotGroup).where(SnapshotGroup.id == group_id))
    db_group = result.scalar_one_or_none()
    if not db_group:
        raise HTTPException(status_code=404, detail="快照组不存在")

    # 不允许修改系统分组的is_system属性
    if "is_system" in group and db_group.is_system:
        del group["is_system"]

    for key, value in group.items():
        if hasattr(db_group, key):
            setattr(db_group, key, value)

    await db.commit()
    await db.refresh(db_group)
    return {"id": db_group.id, "name": db_group.name}


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snapshot_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """删除快照组"""
    result = await db.execute(
        select(SnapshotGroup)
        .options(
            selectinload(SnapshotGroup.children),
            selectinload(SnapshotGroup.snapshots)
        )
        .where(SnapshotGroup.id == group_id)
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="快照组不存在")

    # 检查是否为系统分组
    if group.is_system:
        raise HTTPException(status_code=400, detail="系统分组不可删除")

    # 检查是否有子分组
    if group.children:
        raise HTTPException(status_code=400, detail="请先删除子分组")

    # 检查是否有快照
    if group.snapshots:
        raise HTTPException(status_code=400, detail="请先删除或迁移快照")

    await db.delete(group)
    await db.commit()


@router.get("", response_model=List[dict])
async def list_snapshots(
    group_id: int = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取快照列表"""
    query = select(Snapshot)
    if group_id:
        query = query.where(Snapshot.group_id == group_id)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    snapshots = result.scalars().all()

    # 获取所有快照的最新构建任务
    snapshot_ids = [s.id for s in snapshots]
    tasks_result = await db.execute(
        select(SnapshotBuildTask)
        .where(SnapshotBuildTask.snapshot_id.in_(snapshot_ids))
        .order_by(SnapshotBuildTask.id.desc())
    )
    all_tasks = tasks_result.scalars().all()

    # 按快照ID分组，取每个快照的最新任务
    from collections import defaultdict
    latest_tasks = {}
    for task in all_tasks:
        if task.snapshot_id not in latest_tasks:
            latest_tasks[task.snapshot_id] = task

    return [
        {
            "id": s.id,
            "group_id": s.group_id,
            "name": s.name,
            "snapshot_time": s.snapshot_time.isoformat(),
            "is_default": s.is_default,
            "description": s.description,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat(),
            "build_status": {
                "status": latest_tasks[s.id].status,
                "progress": latest_tasks[s.id].progress,
                "total_communications": latest_tasks[s.id].total_communications,
                "completed_communications": latest_tasks[s.id].completed_communications,
                "current_communication": latest_tasks[s.id].current_communication,
                "error_message": latest_tasks[s.id].error_message,
            } if s.id in latest_tasks else None,
        }
        for s in snapshots
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_snapshot(
    snapshot: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """创建快照"""
    snapshot_time = snapshot.get("snapshot_time")
    if isinstance(snapshot_time, str):
        snapshot_time = datetime.fromisoformat(snapshot_time)
    else:
        snapshot_time = datetime.utcnow()

    db_snapshot = Snapshot(
        group_id=snapshot["group_id"],
        name=snapshot["name"],
        snapshot_time=snapshot_time,
        is_default=snapshot.get("is_default", False),
        description=snapshot.get("description"),
    )
    db.add(db_snapshot)
    await db.commit()
    await db.refresh(db_snapshot)
    return {"id": db_snapshot.id, "name": db_snapshot.name}


@router.get("/instances")
async def list_snapshot_instances(
    snapshot_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取快照实例列表"""
    query = select(SnapshotInstance)
    if snapshot_id:
        query = query.where(SnapshotInstance.snapshot_id == snapshot_id)
    result = await db.execute(query)
    instances = result.scalars().all()
    return [
        {
            "id": inst.id,
            "snapshot_id": inst.snapshot_id,
            "communication_id": inst.communication_id,
            "check_item_list_id": inst.check_item_list_id,
            "created_at": inst.created_at.isoformat() if inst.created_at else None,
        }
        for inst in instances
    ]


@router.get("/instances/{instance_id}")
async def get_snapshot_instance(
    instance_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取快照实例详情"""
    result = await db.execute(select(SnapshotInstance).where(SnapshotInstance.id == instance_id))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="快照实例不存在")

    result = await db.execute(
        select(EnvironmentData).where(EnvironmentData.snapshot_instance_id == instance_id)
    )
    env_data_list = result.scalars().all()

    return {
        "id": instance.id,
        "snapshot_id": instance.snapshot_id,
        "communication_id": instance.communication_id,
        "created_at": instance.created_at.isoformat(),
        "environment_data": [
            {
                "check_item_id": ed.check_item_id,
                "data_value": ed.data_value,
                "checksum": ed.checksum,
                "created_at": ed.created_at.isoformat(),
            }
            for ed in env_data_list
        ],
    }


@router.delete("/instances/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snapshot_instance(
    instance_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """删除快照实例"""
    result = await db.execute(select(SnapshotInstance).where(SnapshotInstance.id == instance_id))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="快照实例不存在")

    await db.delete(instance)
    await db.commit()


@router.get("/{snapshot_id}")
async def get_snapshot(
    snapshot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取快照详情"""
    result = await db.execute(select(Snapshot).where(Snapshot.id == snapshot_id))
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=404, detail="快照不存在")
    return {
        "id": snapshot.id,
        "group_id": snapshot.group_id,
        "name": snapshot.name,
        "snapshot_time": snapshot.snapshot_time.isoformat(),
        "is_default": snapshot.is_default,
        "description": snapshot.description,
    }


@router.delete("/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snapshot(
    snapshot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """删除快照"""
    result = await db.execute(select(Snapshot).where(Snapshot.id == snapshot_id))
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=404, detail="快照不存在")

    await db.delete(snapshot)
    await db.commit()


@router.post("/{snapshot_id}/build")
async def build_snapshot(
    snapshot_id: int,
    communication_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """构建快照 - 通过 SSH 收集数据"""
    result = await db.execute(select(Snapshot).where(Snapshot.id == snapshot_id))
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=404, detail="快照不存在")
    
    result = await db.execute(select(Communication).where(Communication.id == communication_id))
    communication = result.scalar_one_or_none()
    if not communication:
        raise HTTPException(status_code=404, detail="通信机不存在")
    
    result = await db.execute(
        select(SnapshotInstance).where(
            SnapshotInstance.snapshot_id == snapshot_id,
            SnapshotInstance.communication_id == communication_id
        )
    )
    existing_instance = result.scalar_one_or_none()
    if existing_instance:
        raise HTTPException(status_code=400, detail="该通信机的快照实例已存在")
    
    ssh_client = SSHClientWrapper(
        host=communication.ip_address,
        port=communication.port or 22,
        username=communication.username or "root",
        password=communication.password,
    )
    
    try:
        if not await ssh_client.connect():
            raise HTTPException(status_code=500, detail="SSH 连接失败")
        
        snapshot_instance = SnapshotInstance(
            snapshot_id=snapshot_id,
            communication_id=communication_id,
            check_item_list_id=snapshot.group.check_item_list_id if snapshot.group else None,
        )
        db.add(snapshot_instance)
        await db.flush()
        
        if snapshot.group and snapshot.group.check_item_list_id:
            result = await db.execute(
                select(CheckItem).where(
                    CheckItem.list_id == snapshot.group.check_item_list_id
                )
            )
            check_items = result.scalars().all()

            for check_item in check_items:
                if not check_item:
                    continue
                
                data_value = await _collect_item_data(ssh_client, check_item)
                
                env_data = EnvironmentData(
                    snapshot_instance_id=snapshot_instance.id,
                    check_item_id=check_item.id,
                    data_value=data_value,
                )
                db.add(env_data)
        
        await db.commit()
        await db.refresh(snapshot_instance)
        
        return {
            "id": snapshot_instance.id,
            "snapshot_id": snapshot_id,
            "communication_id": communication_id,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"快照构建失败: {str(e)}")
    finally:
        await ssh_client.close()


async def _collect_item_data(ssh_client: SSHClientWrapper, check_item: CheckItem) -> dict:
    """收集单个检查项的数据"""
    item_type = check_item.type
    target_path = check_item.target_path or ""
    
    if item_type == "filesystem":
        if target_path:
            file_info = await ssh_client.get_file_info(target_path)
            if file_info:
                return {"file_info": file_info}
        disk_usage = await ssh_client.get_disk_usage(target_path or "/")
        return {"disk_usage": disk_usage}
    
    elif item_type == "process":
        if target_path:
            exists = await ssh_client.check_process_exists(target_path)
            return {"process_exists": exists, "process_name": target_path}
        return {}
    
    elif item_type == "network":
        return {}
    
    elif item_type == "log":
        if target_path:
            return {"log_path": target_path}
        return {}
    
    elif item_type == "service":
        if target_path:
            status_result = await ssh_client.get_service_status(target_path)
            return {"service_name": target_path, "status": status_result}
        return {}
    
    return {}


# ========== 快照构建 API ==========


@router.get("/build/tasks/active", response_model=List[dict])
async def get_active_build_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取所有活跃的快照构建任务（用于前端表格内轮询）"""
    result = await db.execute(
        select(SnapshotBuildTask)
        .where(SnapshotBuildTask.status.in_(["pending", "running"]))
        .order_by(SnapshotBuildTask.start_time.desc())
    )
    tasks = result.scalars().all()

    return [
        {
            "id": t.id,
            "snapshot_id": t.snapshot_id,
            "status": t.status,
            "progress": t.progress,
            "total_communications": t.total_communications,
            "completed_communications": t.completed_communications,
            "current_communication": t.current_communication,
            "error_message": t.error_message,
            "start_time": t.start_time.isoformat() if t.start_time else None,
            "end_time": t.end_time.isoformat() if t.end_time else None,
        }
        for t in tasks
    ]

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

        # 获取快照名称（避免延迟加载）
        snapshot_result = await db.execute(
            select(Snapshot).where(Snapshot.id == task.snapshot_id)
        )
        snapshot = snapshot_result.scalar_one_or_none()
        snapshot_name = snapshot.name if snapshot else "未知快照"

        # 触发 Celery 任务
        try:
            execute_snapshot_build_task.delay(task_id=task.id)
        except Exception as e:
            # Celery 未启动也不影响快照创建
            print(f"警告: Celery 任务调度失败 - {e}")

        return StartBuildResponse(
            task_id=task.id,
            snapshot_id=task.snapshot_id,
            snapshot_name=snapshot_name,
            status=task.status,
            message="构建任务已创建",
        )

    except SnapshotBuildError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"服务器错误: {str(e)}")


@router.get("/build/{task_id}/progress", response_model=BuildProgressResponse)
async def get_build_progress(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取构建进度"""
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

    # Redis 不可用时，从数据库计算进度
    if groups_progress == [] and task.status == "running":
        # 从数据库获取快照和通信机信息来构建进度
        snapshot_result = await db.execute(
            select(Snapshot).where(Snapshot.id == task.snapshot_id)
        )
        snapshot = snapshot_result.scalar_one_or_none()
        if snapshot and task.build_config:
            for config in task.build_config:
                group_id = config.get("group_id")
                comm_ids = config.get("communication_ids", [])
                if comm_ids:
                    comms_result = await db.execute(
                        select(Communication).where(Communication.id.in_(comm_ids))
                    )
                    comms = comms_result.scalars().all()
                    groups_progress.append(GroupProgress(
                        group_id=group_id,
                        group_name=config.get("group_name", f"组{group_id}"),
                        status=task.status,
                        progress=task.progress,
                        communications=[
                            CommunicationProgress(
                                id=c.id,
                                name=c.name,
                                status="running" if task.completed_communications < len(comm_ids) else "success"
                            )
                            for c in comms
                        ],
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



# 快照管理 API
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, SnapshotGroup, Snapshot, SnapshotInstance, EnvironmentData, Communication
from app.models.check_item import CheckItem, CheckItemList, CheckItemListItem
from app.models.check_result import CheckRule
from app.api.users import get_current_active_user
from app.utils.ssh_client import SSHClientWrapper

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
            "check_item_list_id": g.check_item_list_id,
            "default_snapshot_id": g.default_snapshot_id,
            "description": g.description,
            "created_at": g.created_at.isoformat(),
            "updated_at": g.updated_at.isoformat(),
        }
        for g in groups
    ]


@router.post("/groups", status_code=status.HTTP_201_CREATED)
async def create_snapshot_group(
    group: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """创建快照组"""
    db_group = SnapshotGroup(
        name=group["name"],
        check_item_list_id=group.get("check_item_list_id"),
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
        "check_item_list_id": group.check_item_list_id,
        "default_snapshot_id": group.default_snapshot_id,
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
    result = await db.execute(select(SnapshotGroup).where(SnapshotGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="快照组不存在")

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


@router.get("/rules", response_model=List[dict])
async def list_check_rules(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查规则列表"""
    result = await db.execute(select(CheckRule).offset(skip).limit(limit))
    rules = result.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "check_item_list_id": r.check_item_list_id,
            "snapshot_id": r.snapshot_id,
            "description": r.description,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat(),
        }
        for r in rules
    ]


@router.post("/rules", status_code=status.HTTP_201_CREATED)
async def create_check_rule(
    rule: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """创建检查规则"""
    db_rule = CheckRule(
        name=rule["name"],
        check_item_list_id=rule.get("check_item_list_id"),
        snapshot_id=rule.get("snapshot_id"),
        description=rule.get("description"),
    )
    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)
    return {"id": db_rule.id, "name": db_rule.name}


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
                select(CheckItemListItem).where(
                    CheckItemListItem.list_id == snapshot.group.check_item_list_id
                )
            )
            item_links = result.scalars().all()
            
            for link in item_links:
                result = await db.execute(select(CheckItem).where(CheckItem.id == link.item_id))
                check_item = result.scalar_one_or_none()
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

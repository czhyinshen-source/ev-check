# 快照管理 API
from datetime import datetime
from typing import List, Optional
from app.utils.datetime_util import get_now

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, SnapshotGroup, Snapshot, SnapshotInstance, EnvironmentData, Communication
from app.models.check_item import CheckItem, CheckItemList
from app.models.check_result import CheckRule
from app.models.snapshot import SnapshotBuildTask
from app.api.users import get_current_active_user
from app.utils.ssh_client import SSHClientWrapper
from app.services.rule_validator import ensure_not_in_execution_targets
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
    try:
        db.add(db_group)
        await db.commit()
        await db.refresh(db_group)
    except Exception as e:
        await db.rollback()
        # 处理唯一约束冲突
        if "UNIQUE constraint failed" in str(e) or "Duplicate entry" in str(e) or "already exists" in str(e).lower():
            raise HTTPException(status_code=400, detail=f"快照组名称 '{db_group.name}' 已存在")
        raise e
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
        
    await ensure_not_in_execution_targets(db, "snapshot_group_id", group_id, f"快照组 {group.name}")

    await db.delete(group)
    await db.commit()


@router.get("", response_model=List[dict])
async def list_snapshots(
    response: Response,
    group_id: int = None,
    q: Optional[str] = None,
    page: int = 1,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取快照列表"""
    # 计算分页
    skip = (page - 1) * size
    limit = size

    # 构建基础查询
    query = select(Snapshot)
    count_query = select(func.count(Snapshot.id))

    # 应用筛选条件
    if group_id:
        query = query.where(Snapshot.group_id == group_id)
        count_query = count_query.where(Snapshot.group_id == group_id)
    
    if q:
        query = query.where(Snapshot.name.ilike(f"%{q}%"))
        count_query = count_query.where(Snapshot.name.ilike(f"%{q}%"))

    # 获取总数
    total_count = await db.scalar(count_query)
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    # 执行分页查询
    query = query.order_by(Snapshot.id.desc()).offset(skip).limit(limit)
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
            "snapshot_time": s.snapshot_time.isoformat() if s.snapshot_time else None,
            "is_default": s.is_default,
            "description": s.description,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
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
        snapshot_time = get_now()

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
    
    # 如果有文件数据，一次性加载文件内容
    file_data = {}
    if instance.data_path:
        import os
        import json
        if os.path.exists(instance.data_path):
            try:
                with open(instance.data_path, 'r', encoding='utf-8') as f:
                    file_data = json.load(f)
            except Exception as e:
                print(f"加载快照文件失败: {e}")

    return {
        "id": instance.id,
        "snapshot_id": instance.snapshot_id,
        "communication_id": instance.communication_id,
        "created_at": instance.created_at.isoformat(),
        "environment_data": [
            {
                "check_item_id": ed.check_item_id,
                "data_value": file_data.get(str(ed.check_item_id)) if ed.has_file_data else ed.data_value,
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


@router.get("/{snapshot_id}/full_details")
async def get_snapshot_full_details(
    snapshot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取快照全量详情（按检查项聚合）"""
    # 1. 获取快照基本信息
    result = await db.execute(
        select(Snapshot)
        .options(selectinload(Snapshot.group))
        .where(Snapshot.id == snapshot_id)
    )
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=404, detail="快照不存在")

    # 2. 获取该快照下的所有实例及其环境数据
    result = await db.execute(
        select(SnapshotInstance)
        .options(
            selectinload(SnapshotInstance.communication),
            selectinload(SnapshotInstance.environment_data).selectinload(EnvironmentData.check_item)
        )
        .where(SnapshotInstance.snapshot_id == snapshot_id)
    )
    instances = result.scalars().all()

    # 3. 统计汇总信息
    summary = {
        "snapshot_name": snapshot.name,
        "snapshot_time": snapshot.snapshot_time.isoformat(),
        "group_name": snapshot.group.name if snapshot.group else "未知分组",
        "total_instances": len(instances),
        "total_check_items": 0,
        "created_at": snapshot.created_at.isoformat()
    }

    # 4. 按检查项聚合数据
    items_map = {}
    unique_check_item_ids = set()
    instance_files_cache = {} # 缓存已加载的实例文件内容: {instance_id: json_data}

    for inst in instances:
        comm_info = {
            "id": inst.communication.id,
            "name": inst.communication.name,
            "ip": inst.communication.ip_address
        }
        
        # 预加载该实例的文件内容 (如果需要)
        if inst.data_path and inst.id not in instance_files_cache:
            import os
            import json
            if os.path.exists(inst.data_path):
                try:
                    with open(inst.data_path, 'r', encoding='utf-8') as f:
                        instance_files_cache[inst.id] = json.load(f)
                except Exception as e:
                    print(f"聚合过程中加载文件失败 {inst.data_path}: {e}")
                    instance_files_cache[inst.id] = {}
            else:
                instance_files_cache[inst.id] = {}

        for data in inst.environment_data:
            item = data.check_item
            if not item:
                continue
            
            unique_check_item_ids.add(item.id)
            
            if item.id not in items_map:
                items_map[item.id] = {
                    "id": item.id,
                    "name": item.name,
                    "type": item.type,
                    "target_path": item.target_path,
                    "description": item.description,
                    "hosts_data": []
                }
            
            # 获取数据值: 优先从文件缓存读取，其次数据库
            raw_val = data.data_value
            if data.has_file_data:
                cached_data = instance_files_cache.get(inst.id, {})
                raw_val = cached_data.get(str(item.id))

            extracted_val = raw_val
            
            # 对于文件类检查项，保留完整的元数据字典不做提取
            item_type_str = str(item.type or "").lower()
            is_file_type = any(ft in item_type_str for ft in 
                ['file_exists', 'file_permissions', 'file_owner', 'file_group',
                 'file_size', 'file_mtime', 'file_md5', 'filesystem',
                 'file_content', 'kernel_param', 'route_table'])
            
            if not is_file_type and isinstance(raw_val, dict):
                # 仅对非文件类型做智能提取
                if "content" in raw_val:
                    extracted_val = raw_val["content"]
                elif "data" in raw_val:
                    extracted_val = raw_val["data"]
                elif "output" in raw_val:
                    extracted_val = raw_val["output"]
                elif "value" in raw_val:
                    extracted_val = raw_val["value"]
            
            items_map[item.id]["hosts_data"].append({
                "hostname": comm_info["name"],
                "ip": comm_info["ip"],
                "value": extracted_val,
                "collected_at": data.created_at.isoformat()
            })

    summary["total_check_items"] = len(unique_check_item_ids)

    return {
        "summary": summary,
        "items": list(items_map.values())
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
        
    await ensure_not_in_execution_targets(db, "snapshot_id", snapshot_id, f"快照 {snapshot.name}")

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
    raw_type = check_item.type
    target_path = check_item.target_path or ""
    
    # 规范化 type：可能是字符串、JSON 数组字符串或列表
    import json
    if isinstance(raw_type, str):
        try:
            parsed = json.loads(raw_type)
            types = parsed if isinstance(parsed, list) else [parsed]
        except (json.JSONDecodeError, TypeError):
            types = [raw_type]
    elif isinstance(raw_type, list):
        types = raw_type
    else:
        types = [str(raw_type)]
    
    # 判断是否属于文件系统类检查
    file_types = {"filesystem", "file_exists", "file_permissions", "file_owner", 
                  "file_group", "file_size", "file_mtime", "file_md5"}
    is_file_check = any(t in file_types for t in types)
    
    # 判断是否属于文件内容类检查
    content_types = {"file_content", "kernel_param"}
    is_content_check = any(t in content_types for t in types)
    
    # 判断是否属于路由表检查
    is_route_check = "route_table" in types
    
    if is_file_check:
        data = {"exists": False}
        if target_path:
            file_info = await ssh_client.get_file_info(target_path)
            if file_info:
                data.update(file_info)
                data["exists"] = True
                md5 = await ssh_client.get_file_md5(target_path)
                if md5:
                    data["md5"] = md5
        else:
            disk_usage = await ssh_client.get_disk_usage("/")
            data["disk_usage"] = disk_usage
        return data
    
    elif is_content_check:
        data = {"exists": False}
        if target_path:
            file_info = await ssh_client.get_file_info(target_path)
            if file_info:
                data["exists"] = True
                data.update(file_info)
                # 读取文件内容
                content = await ssh_client.execute_command(f"cat {target_path}")
                if content is not None:
                    data["content"] = content.strip()
                # 如果是内核参数，也读 sysctl
                if "kernel_param" in types:
                    param_name = target_path.replace("/proc/sys/", "").replace("/", ".")
                    sysctl_out = await ssh_client.execute_command(f"sysctl {param_name}")
                    if sysctl_out:
                        data["sysctl_value"] = sysctl_out.strip()
        return data
    
    elif is_route_check:
        route_output = await ssh_client.execute_command("ip route show")
        return {"route_table": route_output.strip() if route_output else ""}
    
    elif any(t == "process" for t in types):
        if target_path:
            exists = await ssh_client.check_process_exists(target_path)
            return {"process_exists": exists, "process_name": target_path}
        return {}
    
    elif any(t == "service" for t in types):
        if target_path:
            status_result = await ssh_client.get_service_status(target_path)
            return {"service_name": target_path, "status": status_result}
        return {}
    
    # 兜底：尝试作为文件采集
    if target_path:
        data = {"exists": False}
        file_info = await ssh_client.get_file_info(target_path)
        if file_info:
            data.update(file_info)
            data["exists"] = True
        return data
    
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


@router.get("/instances")
async def list_snapshot_instances(
    snapshot_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取快照的底层实例"""
    from app.models.snapshot import SnapshotInstance
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

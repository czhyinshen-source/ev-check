# 配置导入导出 API
import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.models.check_item import CheckItem, CheckItemList
from app.models.communication import Communication, CommunicationGroup
from app.models.snapshot import SnapshotGroup, Snapshot
from app.models.check_result import CheckRule, ScheduledTask
from app.api.users import get_current_active_user

router = APIRouter(prefix="/config", tags=["配置管理"])


@router.get("/export")
async def export_config(
    include_users: bool = False,
    include_ssh_keys: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """导出系统配置"""
    config = {
        "export_time": datetime.utcnow().isoformat(),
        "version": "1.0",
        "check_items": [],
        "check_item_lists": [],
        "communication_groups": [],
        "communications": [],
        "snapshot_groups": [],
        "snapshots": [],
        "check_rules": [],
        "scheduled_tasks": [],
    }
    
    result = await db.execute(select(CheckItem))
    items = result.scalars().all()
    for item in items:
        config["check_items"].append({
            "name": item.name,
            "type": item.type,
            "target_path": item.target_path,
            "check_attributes": item.check_attributes,
            "description": item.description,
        })
    
    result = await db.execute(select(CheckItemList))
    lists = result.scalars().all()
    for lst in lists:
        config["check_item_lists"].append({
            "name": lst.name,
            "description": lst.description,
            "item_names": [item.name for item in lst.items],
        })
    
    result = await db.execute(select(CommunicationGroup))
    groups = result.scalars().all()
    for group in groups:
        config["communication_groups"].append({
            "name": group.name,
            "description": group.description,
        })
    
    result = await db.execute(select(Communication))
    comms = result.scalars().all()
    for comm in comms:
        config["communications"].append({
            "name": comm.name,
            "ip_address": comm.ip_address,
            "port": comm.port,
            "username": comm.username,
            "group_name": comm.group.name if comm.group else None,
            "description": comm.description,
        })
    
    result = await db.execute(select(SnapshotGroup))
    snap_groups = result.scalars().all()
    for sg in snap_groups:
        config["snapshot_groups"].append({
            "name": sg.name,
            "description": sg.description,
            "check_item_list_name": sg.check_item_list.name if sg.check_item_list else None,
        })
    
    result = await db.execute(select(CheckRule))
    rules = result.scalars().all()
    for rule in rules:
        config["check_rules"].append({
            "name": rule.name,
            "description": rule.description,
        })
    
    result = await db.execute(select(ScheduledTask))
    tasks = result.scalars().all()
    for task in tasks:
        config["scheduled_tasks"].append({
            "name": task.name,
            "rule_name": task.rule.name if task.rule else None,
            "cron_expression": task.cron_expression,
            "is_active": task.is_active,
        })
    
    return config


@router.post("/import")
async def import_config(
    config: dict,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user)
):
    """导入系统配置"""
    imported = {"check_items": 0, "check_item_lists": 0, "communication_groups": 0, "communications": 0}
    
    for item_data in config.get("check_items", []):
        result = await db.execute(select(CheckItem).where(CheckItem.name == item_data["name"]))
        if not result.scalar_one_or_none():
            db_item = CheckItem(**item_data)
            db.add(db_item)
            imported["check_items"] += 1
    
    for list_data in config.get("check_item_lists", []):
        result = await db.execute(select(CheckItemList).where(CheckItemList.name == list_data["name"]))
        if not result.scalar_one_or_none():
            db_list = CheckItemList(
                name=list_data["name"],
                description=list_data.get("description"),
            )
            db.add(db_list)
            await db.flush()
            
            for item_name in list_data.get("item_names", []):
                result = await db.execute(select(CheckItem).where(CheckItem.name == item_name))
                item = result.scalar_one_or_none()
                if item:
                    db_list.items.append(item)
            
            imported["check_item_lists"] += 1
    
    for group_data in config.get("communication_groups", []):
        result = await db.execute(select(CommunicationGroup).where(CommunicationGroup.name == group_data["name"]))
        if not result.scalar_one_or_none():
            db_group = CommunicationGroup(
                name=group_data["name"],
                description=group_data.get("description"),
            )
            db.add(db_group)
            imported["communication_groups"] += 1
    
    for comm_data in config.get("communications", []):
        result = await db.execute(select(Communication).where(Communication.name == comm_data["name"]))
        if not result.scalar_one_or_none():
            group_id = None
            if comm_data.get("group_name"):
                result = await db.execute(select(CommunicationGroup).where(CommunicationGroup.name == comm_data["group_name"]))
                group = result.scalar_one_or_none()
                if group:
                    group_id = group.id
            
            db_comm = Communication(
                name=comm_data["name"],
                ip_address=comm_data["ip_address"],
                port=comm_data.get("port", 22),
                username=comm_data.get("username", "root"),
                group_id=group_id,
                description=comm_data.get("description"),
            )
            db.add(db_comm)
            imported["communications"] += 1
    
    await db.commit()
    
    return {
        "message": "配置导入成功",
        "imported": imported,
    }

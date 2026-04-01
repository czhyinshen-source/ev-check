# 检查规则 API
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User
from app.models.check_result import (
    CheckRule, ScheduledTask, CheckRuleSnapshot, CheckRuleCheckItem, CheckRuleCommunication
)
from app.schemas.check_rule import (
    CheckRuleCreate,
    CheckRuleUpdate,
    CheckRuleResponse,
    ScheduledTaskCreate,
    ScheduledTaskUpdate,
    ScheduledTaskResponse,
)
from app.api.users import get_current_active_user
from app.tasks.scheduled_tasks import update_celery_schedule, remove_from_schedule

router = APIRouter(prefix="/check-rules", tags=["检查规则管理"])


async def _populate_rule_response(rule: CheckRule) -> dict:
    data = {
        "id": rule.id, "name": rule.name, "description": rule.description,
        "is_active": rule.is_active, "allow_manual_execution": rule.allow_manual_execution,
        "cron_expression": rule.cron_expression, "time_window_start": rule.time_window_start,
        "time_window_end": rule.time_window_end, "time_window_weekdays": rule.time_window_weekdays,
        "created_at": rule.created_at, "updated_at": rule.updated_at
    }
    data["snapshot_ids"] = [link.snapshot_id for link in rule.snapshot_links if link.snapshot_id]
    data["snapshot_group_ids"] = [link.snapshot_group_id for link in rule.snapshot_links if link.snapshot_group_id]
    data["check_item_ids"] = [link.check_item_id for link in rule.check_item_links if link.check_item_id]
    data["check_item_list_ids"] = [link.check_item_list_id for link in rule.check_item_links if link.check_item_list_id]
    data["communication_ids"] = [link.communication_id for link in rule.communication_links if link.communication_id]
    data["communication_group_ids"] = [link.communication_group_id for link in rule.communication_links if link.communication_group_id]
    return data

@router.get("", response_model=List[CheckRuleResponse])
async def list_check_rules(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    """获取检查规则列表"""
    result = await db.execute(
        select(CheckRule)
        .options(selectinload(CheckRule.snapshot_links), selectinload(CheckRule.check_item_links), selectinload(CheckRule.communication_links))
        .offset(skip).limit(limit)
    )
    rules = result.scalars().all()
    return [await _populate_rule_response(r) for r in rules]


@router.get("/{rule_id}", response_model=CheckRuleResponse)
async def get_check_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    """获取检查规则详情"""
    result = await db.execute(
        select(CheckRule)
        .options(selectinload(CheckRule.snapshot_links), selectinload(CheckRule.check_item_links), selectinload(CheckRule.communication_links))
        .where(CheckRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="检查规则不存在")
    return await _populate_rule_response(rule)


@router.post("", response_model=CheckRuleResponse)
async def create_check_rule(rule: CheckRuleCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_active_user)):
    """创建检查规则"""
    result = await db.execute(select(CheckRule).where(CheckRule.name == rule.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="检查规则名称已存在")
    
    rule_data = rule.model_dump(exclude={
        "snapshot_ids", "snapshot_group_ids", "check_item_ids", 
        "check_item_list_ids", "communication_ids", "communication_group_ids"
    })
    db_rule = CheckRule(**rule_data)
    db.add(db_rule)
    await db.flush()
    
    for sid in rule.snapshot_ids: db.add(CheckRuleSnapshot(rule_id=db_rule.id, snapshot_id=sid))
    for sgid in rule.snapshot_group_ids: db.add(CheckRuleSnapshot(rule_id=db_rule.id, snapshot_group_id=sgid))
    for cid in rule.check_item_ids: db.add(CheckRuleCheckItem(rule_id=db_rule.id, check_item_id=cid))
    for clid in rule.check_item_list_ids: db.add(CheckRuleCheckItem(rule_id=db_rule.id, check_item_list_id=clid))
    for cmid in rule.communication_ids: db.add(CheckRuleCommunication(rule_id=db_rule.id, communication_id=cmid))
    for cgid in rule.communication_group_ids: db.add(CheckRuleCommunication(rule_id=db_rule.id, communication_group_id=cgid))
    
    await db.commit()
    return await get_check_rule(db_rule.id, db)


@router.put("/{rule_id}", response_model=CheckRuleResponse)
async def update_check_rule(rule_id: int, rule: CheckRuleUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_active_user)):
    """更新检查规则"""
    result = await db.execute(
        select(CheckRule)
        .options(selectinload(CheckRule.snapshot_links), selectinload(CheckRule.check_item_links), selectinload(CheckRule.communication_links))
        .where(CheckRule.id == rule_id)
    )
    db_rule = result.scalar_one_or_none()
    if not db_rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="检查规则不存在")
    
    if rule.name and rule.name != db_rule.name:
        existing = await db.execute(select(CheckRule).where(CheckRule.name == rule.name))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="检查规则名称已存在")
    
    update_data = rule.model_dump(exclude_unset=True)
    relations = {"snapshot_ids", "snapshot_group_ids", "check_item_ids", "check_item_list_ids", "communication_ids", "communication_group_ids"}
    
    for field in set(update_data.keys()) - relations:
        setattr(db_rule, field, update_data[field])
        
    if any(rel in update_data for rel in relations):
        await db.execute(CheckRuleSnapshot.__table__.delete().where(CheckRuleSnapshot.rule_id == rule_id))
        await db.execute(CheckRuleCheckItem.__table__.delete().where(CheckRuleCheckItem.rule_id == rule_id))
        await db.execute(CheckRuleCommunication.__table__.delete().where(CheckRuleCommunication.rule_id == rule_id))
        
        snaps = update_data.get("snapshot_ids", [l.snapshot_id for l in db_rule.snapshot_links if l.snapshot_id])
        s_grps = update_data.get("snapshot_group_ids", [l.snapshot_group_id for l in db_rule.snapshot_links if l.snapshot_group_id])
        c_items = update_data.get("check_item_ids", [l.check_item_id for l in db_rule.check_item_links if l.check_item_id])
        c_lists = update_data.get("check_item_list_ids", [l.check_item_list_id for l in db_rule.check_item_links if l.check_item_list_id])
        comm_ids = update_data.get("communication_ids", [l.communication_id for l in db_rule.communication_links if l.communication_id])
        comm_grps = update_data.get("communication_group_ids", [l.communication_group_id for l in db_rule.communication_links if l.communication_group_id])

        for sid in snaps: db.add(CheckRuleSnapshot(rule_id=rule_id, snapshot_id=sid))
        for sgid in s_grps: db.add(CheckRuleSnapshot(rule_id=rule_id, snapshot_group_id=sgid))
        for cid in c_items: db.add(CheckRuleCheckItem(rule_id=rule_id, check_item_id=cid))
        for clid in c_lists: db.add(CheckRuleCheckItem(rule_id=rule_id, check_item_list_id=clid))
        for cmid in comm_ids: db.add(CheckRuleCommunication(rule_id=rule_id, communication_id=cmid))
        for cg in comm_grps: db.add(CheckRuleCommunication(rule_id=rule_id, communication_group_id=cg))
            
    await db.commit()
    return await get_check_rule(rule_id, db)

@router.patch("/{rule_id}/toggle", response_model=CheckRuleResponse)
async def toggle_check_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    """启停检查规则"""
    result = await db.execute(select(CheckRule).where(CheckRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="检查规则不存在")
    rule.is_active = not rule.is_active
    await db.commit()
    return await get_check_rule(rule_id, db)


@router.post("/{rule_id}/execute")
async def execute_check_rule(
    rule_id: int, 
    db: AsyncSession = Depends(get_db), 
    _: User = Depends(get_current_active_user)
):
    """手动执行检查规则"""
    result = await db.execute(select(CheckRule).where(CheckRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="检查规则不存在")
        
    if not rule.allow_manual_execution:
        raise HTTPException(status_code=400, detail="此检查规则不允许手动执行")
        
    from app.tasks.check_tasks import execute_batch_check_task
    task = execute_batch_check_task.delay(rule_id=rule_id)
    
    return {
        "message": "已触发执行任务",
        "task_id": task.id
    }


@router.delete("/{rule_id}")
async def delete_check_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user)
):
    """删除检查规则"""
    result = await db.execute(
        select(CheckRule).where(CheckRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="检查规则不存在"
        )
    
    await db.delete(rule)
    await db.commit()
    return {"message": "检查规则已删除"}


@router.get("/scheduled-tasks/{task_id}", response_model=ScheduledTaskResponse)
async def get_scheduled_task(
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """获取定时任务详情"""
    result = await db.execute(
        select(ScheduledTask).where(ScheduledTask.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="定时任务不存在"
        )
    return task


@router.post("/scheduled-tasks", response_model=ScheduledTaskResponse)
async def create_scheduled_task(
    task: ScheduledTaskCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user)
):
    """创建定时任务"""
    db_task = ScheduledTask(**task.model_dump())
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)
    
    if db_task.is_active and db_task.cron_expression:
        try:
            task_name = f"scheduled_task_{db_task.id}"
            update_celery_schedule(db_task.id, db_task.cron_expression, task_name)
        except Exception:
            pass
    
    return db_task


@router.put("/scheduled-tasks/{task_id}", response_model=ScheduledTaskResponse)
async def update_scheduled_task(
    task_id: int,
    task: ScheduledTaskUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user)
):
    """更新定时任务"""
    result = await db.execute(
        select(ScheduledTask).where(ScheduledTask.id == task_id)
    )
    db_task = result.scalar_one_or_none()
    if not db_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="定时任务不存在"
        )
    
    for key, value in task.model_dump(exclude_unset=True).items():
        setattr(db_task, key, value)
    
    await db.commit()
    await db.refresh(db_task)
    
    task_name = f"scheduled_task_{task_id}"
    try:
        if db_task.is_active and db_task.cron_expression:
            update_celery_schedule(task_id, db_task.cron_expression, task_name)
        else:
            remove_from_schedule(task_name)
    except Exception:
        pass
    
    return db_task


@router.delete("/scheduled-tasks/{task_id}")
async def delete_scheduled_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user)
):
    """删除定时任务"""
    result = await db.execute(
        select(ScheduledTask).where(ScheduledTask.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="定时任务不存在"
        )
    
    task_name = f"scheduled_task_{task_id}"
    try:
        remove_from_schedule(task_name)
    except Exception:
        pass
    
    await db.delete(task)
    await db.commit()
    return {"message": "定时任务已删除"}

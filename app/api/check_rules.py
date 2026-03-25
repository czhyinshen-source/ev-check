# 检查规则 API
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User
from app.models.check_result import CheckRule, ScheduledTask
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


@router.get("", response_model=List[CheckRuleResponse])
async def list_check_rules(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """获取检查规则列表"""
    result = await db.execute(
        select(CheckRule).offset(skip).limit(limit)
    )
    rules = result.scalars().all()
    return rules


@router.get("/scheduled-tasks", response_model=List[ScheduledTaskResponse])
async def list_scheduled_tasks(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """获取定时任务列表"""
    result = await db.execute(
        select(ScheduledTask).offset(skip).limit(limit)
    )
    tasks = result.scalars().all()
    return tasks


@router.get("/{rule_id}", response_model=CheckRuleResponse)
async def get_check_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """获取检查规则详情"""
    result = await db.execute(
        select(CheckRule).where(CheckRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="检查规则不存在"
        )
    return rule


@router.post("", response_model=CheckRuleResponse)
async def create_check_rule(
    rule: CheckRuleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user)
):
    """创建检查规则"""
    result = await db.execute(
        select(CheckRule).where(CheckRule.name == rule.name)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="检查规则名称已存在"
        )
    
    db_rule = CheckRule(**rule.model_dump())
    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)
    return db_rule


@router.put("/{rule_id}", response_model=CheckRuleResponse)
async def update_check_rule(
    rule_id: int,
    rule: CheckRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user)
):
    """更新检查规则"""
    result = await db.execute(
        select(CheckRule).where(CheckRule.id == rule_id)
    )
    db_rule = result.scalar_one_or_none()
    if not db_rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="检查规则不存在"
        )
    
    if rule.name and rule.name != db_rule.name:
        result = await db.execute(
            select(CheckRule).where(CheckRule.name == rule.name)
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="检查规则名称已存在"
            )
    
    for key, value in rule.model_dump(exclude_unset=True).items():
        setattr(db_rule, key, value)
    
    await db.commit()
    await db.refresh(db_rule)
    return db_rule


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

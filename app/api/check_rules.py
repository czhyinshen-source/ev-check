# 检查规则 API
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User
from app.models.check_result import (
    CheckRule, ScheduledTask
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
        "execution_targets": rule.execution_targets or [],
        "created_at": rule.created_at, "updated_at": rule.updated_at
    }
    return data

@router.get("", response_model=List[CheckRuleResponse])
async def list_check_rules(
    response: Response,
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db)
):
    """获取检查规则列表"""
    # 获取总数
    total_count = await db.scalar(select(func.count(CheckRule.id)))
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    result = await db.execute(
        select(CheckRule)
        .offset(skip).limit(limit)
    )
    rules = result.scalars().all()
    return [await _populate_rule_response(r) for r in rules]


@router.get("/{rule_id}", response_model=CheckRuleResponse)
async def get_check_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    """获取检查规则详情"""
    result = await db.execute(
        select(CheckRule)
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
    
    rule_data = rule.model_dump()
    # execution_targets in the dict will directly be stored to the JSON column.
    
    db_rule = CheckRule(**rule_data)
    db.add(db_rule)
    
    await db.commit()
    return await get_check_rule(db_rule.id, db)


@router.put("/{rule_id}", response_model=CheckRuleResponse)
async def update_check_rule(rule_id: int, rule: CheckRuleUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_active_user)):
    """更新检查规则"""
    result = await db.execute(
        select(CheckRule)
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
    
    for field, value in update_data.items():
        setattr(db_rule, field, value)
            
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
        
    # 前置检查锁，避免 Celery 吞吐报错导致用户无感知
    from app.services.check_lock import get_check_lock_manager
    from app.services.check_service import CheckExecutionService
    lock_manager = get_check_lock_manager()
    if await lock_manager.is_locked():
        task_id = await lock_manager.get_current_task_id()
        raise HTTPException(status_code=400, detail=f"已有检查任务正在执行 (任务ID: {task_id})，请将其完成或取消后再试。如果是意外挂起，请管理员清理 Redis 锁 (ev_check:execution_lock)。")

    if not rule.execution_targets:
        raise HTTPException(status_code=400, detail="该检查规则目前没有配置任何执行目标基准策略行，无法执行！请先编辑规则添加至少一行执行目标。")

    from app.tasks.check_tasks import execute_batch_check_task
    task = execute_batch_check_task.delay(rule_id=rule_id)
    
    return {
        "message": "已触发执行任务",
        "task_id": task.id
    }


@router.post("/{rule_id}/cancel-execute")
async def cancel_execute_check_rule(
    rule_id: int, 
    db: AsyncSession = Depends(get_db), 
    _: User = Depends(get_current_active_user)
):
    """强制取消/清理当前规则所有卡在执行中的僵死任务"""
    from app.services.check_lock import get_check_lock_manager
    from app.models.check_result import CheckResult
    
    # 查找所有当前规则下处于 pending 或 running 状态的任务
    result = await db.execute(
        select(CheckResult)
        .where(CheckResult.rule_id == rule_id)
        .where(CheckResult.status.in_(["pending", "running"]))
    )
    stuck_tasks = result.scalars().all()
    
    if not stuck_tasks:
        # 即便没有找到，也尝试释放相关锁，以防万一锁被无主任务持有
        lock_manager = get_check_lock_manager()
        if await lock_manager.is_locked():
            await lock_manager.force_release_lock()
        return {"message": "未发现卡住的任务"}
        
    import datetime
    lock_manager = get_check_lock_manager()
    
    # 标记为已取消并释放对应的锁
    for task in stuck_tasks:
        task.status = "failed"
        task.error_message = "用户手动强制取消/清理任务"
        task.end_time = datetime.datetime.utcnow()
        await lock_manager.release_lock(task.id)
    
    # 最后加上强力保障，直接删除全局锁
    if await lock_manager.is_locked():
        await lock_manager.force_release_lock()
        
    await db.commit()
    
    return {"message": f"已成功取消 {len(stuck_tasks)} 个僵死任务并清理锁"}


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

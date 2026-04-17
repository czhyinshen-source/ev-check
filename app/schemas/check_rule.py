# 检查规则 Schema
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field


class ExecutionTarget(BaseModel):
    id: Optional[str] = None
    snapshot_id: Optional[int] = None
    communications: dict = Field(default_factory=lambda: {"ids": [], "group_ids": []})
    check_items: dict = Field(default_factory=lambda: {"ids": [], "list_ids": []})


class CheckRuleBase(BaseModel):
    """检查规则基础"""
    name: str
    description: Optional[str] = None
    is_active: bool = True
    allow_manual_execution: bool = True
    cron_expression: Optional[str] = None
    time_window_start: Optional[str] = None
    time_window_end: Optional[str] = None
    time_window_weekdays: Optional[str] = None


class CheckRuleCreate(CheckRuleBase):
    """检查规则创建"""
    execution_targets: List[ExecutionTarget] = []


class CheckRuleUpdate(BaseModel):
    """检查规则更新"""
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    allow_manual_execution: Optional[bool] = None
    cron_expression: Optional[str] = None
    time_window_start: Optional[str] = None
    time_window_end: Optional[str] = None
    time_window_weekdays: Optional[str] = None
    execution_targets: Optional[List[ExecutionTarget]] = None


class CheckRuleResponse(CheckRuleBase):
    """检查规则响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    execution_targets: Optional[List[ExecutionTarget]] = []


class ScheduledTaskBase(BaseModel):
    """定时任务基础"""
    name: str
    rule_id: Optional[int] = None
    cron_expression: Optional[str] = None
    is_active: bool = True


class ScheduledTaskCreate(ScheduledTaskBase):
    """定时任务创建"""
    pass


class ScheduledTaskUpdate(BaseModel):
    """定时任务更新"""
    name: Optional[str] = None
    rule_id: Optional[int] = None
    cron_expression: Optional[str] = None
    is_active: Optional[bool] = None


class ScheduledTaskResponse(ScheduledTaskBase):
    """定时任务响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

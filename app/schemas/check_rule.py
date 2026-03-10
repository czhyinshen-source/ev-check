# 检查规则 Schema
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


class CheckRuleBase(BaseModel):
    """检查规则基础"""
    name: str
    check_item_list_id: Optional[int] = None
    snapshot_id: Optional[int] = None
    description: Optional[str] = None


class CheckRuleCreate(CheckRuleBase):
    """检查规则创建"""
    pass


class CheckRuleUpdate(BaseModel):
    """检查规则更新"""
    name: Optional[str] = None
    check_item_list_id: Optional[int] = None
    snapshot_id: Optional[int] = None
    description: Optional[str] = None


class CheckRuleResponse(CheckRuleBase):
    """检查规则响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


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

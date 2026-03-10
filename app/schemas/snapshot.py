# 快照 Schema
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


class SnapshotGroupBase(BaseModel):
    """快照组基础"""
    name: str
    check_item_list_id: Optional[int] = None
    default_snapshot_id: Optional[int] = None
    description: Optional[str] = None


class SnapshotGroupCreate(SnapshotGroupBase):
    """快照组创建"""
    pass


class SnapshotGroupUpdate(BaseModel):
    """快照组更新"""
    name: Optional[str] = None
    check_item_list_id: Optional[int] = None
    default_snapshot_id: Optional[int] = None
    description: Optional[str] = None


class SnapshotGroupResponse(SnapshotGroupBase):
    """快照组响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class SnapshotBase(BaseModel):
    """快照基础"""
    group_id: int
    name: str
    snapshot_time: datetime
    is_default: bool = False
    description: Optional[str] = None


class SnapshotCreate(SnapshotBase):
    """快照创建"""
    communication_ids: Optional[List[int]] = None


class SnapshotResponse(SnapshotBase):
    """快照响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


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


class CheckResultBase(BaseModel):
    """检查结果基础"""
    rule_id: Optional[int] = None
    communication_id: Optional[int] = None
    status: str = "pending"
    progress: int = 0


class CheckResultResponse(CheckResultBase):
    """检查结果响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime

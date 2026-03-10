# 检查项 Schema
from datetime import datetime
from typing import Optional, List, Union

from pydantic import BaseModel, ConfigDict


class CheckItemBase(BaseModel):
    """检查项基础"""
    name: str
    type: Optional[Union[str, List[str]]] = None
    target_path: Optional[str] = None
    check_attributes: Optional[dict] = None
    description: Optional[str] = None


class CheckItemCreate(CheckItemBase):
    """检查项创建"""
    pass


class CheckItemUpdate(BaseModel):
    """检查项更新"""
    name: Optional[str] = None
    type: Optional[Union[str, List[str]]] = None
    target_path: Optional[str] = None
    check_attributes: Optional[dict] = None
    description: Optional[str] = None


class CheckItemResponse(CheckItemBase):
    """检查项响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class CheckItemListBase(BaseModel):
    """检查项列表基础"""
    name: str
    description: Optional[str] = None


class CheckItemListCreate(CheckItemListBase):
    """检查项列表创建"""
    item_ids: Optional[List[int]] = None


class CheckItemListUpdate(BaseModel):
    """检查项列表更新"""
    name: Optional[str] = None
    description: Optional[str] = None
    item_ids: Optional[List[int]] = None


class CheckItemListResponse(BaseModel):
    """检查项列表响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[CheckItemResponse] = []

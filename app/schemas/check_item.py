# 检查项 Schema
from datetime import datetime
from enum import Enum
from typing import Optional, List, Union

from pydantic import BaseModel, ConfigDict, field_validator


class CheckItemType(str, Enum):
    """检查项类型枚举"""
    # 文件/目录检查
    FILE_EXISTS = "file_exists"          # 存在性检查
    FILE_PERMISSIONS = "file_permissions" # 权限检查
    FILE_OWNER = "file_owner"            # 属主检查
    FILE_GROUP = "file_group"            # 属组检查
    FILE_SIZE = "file_size"              # 大小检查
    FILE_MTIME = "file_mtime"            # 修改时间检查
    FILE_MD5 = "file_md5"                # MD5检查
    FILE_CONTENT = "file_content"        # 文件内容检查
    KERNEL_PARAM = "kernel_param"        # 内核参数检查
    # 路由表检查
    ROUTE_TABLE = "route_table"          # 路由表检查


class CompareMode(str, Enum):
    """比较模式枚举"""
    SNAPSHOT = "snapshot"    # 与快照比较
    SPECIFIED = "specified"  # 指定值比较


class FileContentType(str, Enum):
    """文件内容类型"""
    TEXT = "text"           # 普通文本文件
    KERNEL_PARAM = "kernel" # 内核参数文件


class FileContentCompareMode(str, Enum):
    """文件内容比较模式"""
    FULL = "full"           # 完整内容比较
    PARTIAL = "partial"     # 部分内容比较
    CONTAINS = "contains"   # 包含指定文本
    NOT_CONTAINS = "not_contains"  # 不包含指定文本


class RouteTableMode(str, Enum):
    """路由表模式"""
    FULL = "full"      # 采集全量路由表
    CHECK = "check"    # 检查指定路由规则


class FileTimeAttributes(BaseModel):
    """文件时间检查属性"""
    compare_mode: CompareMode = CompareMode.SNAPSHOT
    start_time: Optional[str] = None   # 下限值
    end_time: Optional[str] = None     # 上限值


class FileSizeAttributes(BaseModel):
    """文件大小检查属性"""
    compare_mode: CompareMode = CompareMode.SNAPSHOT
    min_size: Optional[int] = None  # 下限值(字节)
    max_size: Optional[int] = None  # 上限值(字节)


class FileOwnerAttributes(BaseModel):
    """属主检查属性"""
    compare_mode: CompareMode = CompareMode.SNAPSHOT
    owner: Optional[str] = None  # 用户名或UID


class FileGroupAttributes(BaseModel):
    """属组检查属性"""
    compare_mode: CompareMode = CompareMode.SNAPSHOT
    group: Optional[str] = None  # 组名或GID


class FilePermissionsAttributes(BaseModel):
    """权限检查属性"""
    compare_mode: CompareMode = CompareMode.SNAPSHOT
    permissions: Optional[str] = None  # 八进制权限，如755


class FileMd5Attributes(BaseModel):
    """MD5检查属性"""
    compare_mode: CompareMode = CompareMode.SNAPSHOT
    md5_value: Optional[str] = None  # 32位MD5值


class FileContentAttributes(BaseModel):
    """文件内容检查属性"""
    file_type: FileContentType = FileContentType.TEXT
    compare_mode: FileContentCompareMode = FileContentCompareMode.FULL
    content: Optional[str] = None      # 指定比较的内容
    pattern: Optional[str] = None      # 包含/不包含的文本模式


class KernelParamAttributes(BaseModel):
    """内核参数检查属性"""
    compare_mode: CompareMode = CompareMode.SNAPSHOT
    param_name: Optional[str] = None   # 参数名，如net.ipv4.ip_forward
    param_value: Optional[str] = None  # 期望的参数值


class RouteTableAttributes(BaseModel):
    """路由表检查属性"""
    mode: RouteTableMode = RouteTableMode.FULL
    route_rule: Optional[str] = None  # 路由规则


class CheckItemBase(BaseModel):
    """检查项基础"""
    name: str
    type: Optional[Union[str, List[str]]] = None
    target_path: Optional[str] = None
    check_attributes: Optional[dict] = None
    description: Optional[str] = None


class CheckItemCreate(CheckItemBase):
    """检查项创建"""
    list_id: Optional[int] = None  # 所属检查项列表ID


class CheckItemUpdate(BaseModel):
    """检查项更新"""
    name: Optional[str] = None
    type: Optional[Union[str, List[str]]] = None
    target_path: Optional[str] = None
    check_attributes: Optional[dict] = None
    description: Optional[str] = None
    list_id: Optional[int] = None  # 所属检查项列表ID


class CheckItemResponse(CheckItemBase):
    """检查项响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    list_id: Optional[int] = None
    list_name: Optional[str] = None  # 所属列表名称
    order_index: int = 1  # 列表内序号
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

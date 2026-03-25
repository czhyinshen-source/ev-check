# 快照构建相关 Schema
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class BuildGroupConfig(BaseModel):
    """构建组配置"""
    group_id: int
    communication_ids: Optional[List[int]] = None  # 空表示全选
    check_item_list_id: int


class StartBuildRequest(BaseModel):
    """启动构建请求"""
    snapshot_name: str
    snapshot_group_id: int
    build_config: List[BuildGroupConfig]


class CommunicationProgress(BaseModel):
    """通信机进度"""
    id: int
    name: str
    status: str  # pending, running, success, failed


class GroupProgress(BaseModel):
    """组进度"""
    group_id: int
    group_name: str
    status: str
    progress: int
    communications: List[CommunicationProgress]


class BuildProgressResponse(BaseModel):
    """构建进度响应"""
    id: int
    snapshot_id: int
    status: str
    progress: int
    total_groups: int
    completed_groups: int
    total_communications: int
    completed_communications: int
    current_communication: Optional[str] = None
    groups_progress: List[GroupProgress] = []
    error_message: Optional[str] = None


class StartBuildResponse(BaseModel):
    """启动构建响应"""
    task_id: int
    snapshot_id: int
    snapshot_name: str
    status: str
    message: str = "构建任务已创建"

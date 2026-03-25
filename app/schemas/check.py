# 检查相关 Schema
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field


class StartCheckRequest(BaseModel):
    """启动检查请求"""
    rule_id: int = Field(..., description="检查规则ID")
    communication_id: int = Field(..., description="通信机ID")
    snapshot_id: int = Field(..., description="快照ID")


class StartBatchCheckRequest(BaseModel):
    """启动批量检查请求"""
    rule_id: int = Field(..., description="检查规则ID")
    communication_ids: List[int] = Field(..., description="通信机ID列表")
    snapshot_id: int = Field(..., description="快照ID")


class CheckProgressResponse(BaseModel):
    """检查进度响应"""
    id: int
    status: str  # pending, running, success, failed, cancelled, completed_with_errors
    progress: int  # 0-100
    total_items: int = 0
    completed_items: int = 0
    current_item: Optional[str] = None
    message: Optional[str] = None
    start_time: Optional[datetime] = None


class CheckResultDetailResponse(BaseModel):
    """检查结果详情响应"""
    id: int
    check_item_id: int
    check_item_name: Optional[str] = None
    check_item_type: Optional[str] = None
    status: str  # pass, fail, error
    expected_value: Optional[dict] = None
    actual_value: Optional[dict] = None
    message: Optional[str] = None


class CheckSummary(BaseModel):
    """检查结果摘要"""
    total: int = 0
    passed: int = 0
    failed: int = 0
    errors: int = 0


class CheckResultResponse(BaseModel):
    """检查结果响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    rule_id: Optional[int] = None
    rule_name: Optional[str] = None
    communication_id: Optional[int] = None
    communication_name: Optional[str] = None
    communication_ip: Optional[str] = None
    snapshot_id: Optional[int] = None
    snapshot_name: Optional[str] = None
    status: str
    start_time: datetime
    end_time: Optional[datetime] = None
    progress: int = 0
    error_message: Optional[str] = None
    duration_seconds: Optional[int] = None
    summary: CheckSummary = Field(default_factory=CheckSummary)
    details: List[CheckResultDetailResponse] = Field(default_factory=list)


class CheckResultListItem(BaseModel):
    """检查结果列表项（简化版）"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    rule_id: Optional[int] = None
    rule_name: Optional[str] = None
    communication_id: Optional[int] = None
    communication_name: Optional[str] = None
    status: str
    start_time: datetime
    end_time: Optional[datetime] = None
    progress: int = 0
    error_message: Optional[str] = None
    # 新增字段
    duration_seconds: Optional[int] = None
    snapshot_id: Optional[int] = None
    snapshot_name: Optional[str] = None
    server_count: int = 1
    summary: Optional[CheckSummary] = None


class CurrentTaskResponse(BaseModel):
    """当前任务响应"""
    exists: bool = False
    id: Optional[int] = None
    rule_id: Optional[int] = None
    rule_name: Optional[str] = None
    communication_id: Optional[int] = None
    communication_name: Optional[str] = None
    status: str = "idle"
    progress: int = 0
    total_items: int = 0
    completed_items: int = 0
    current_item: Optional[str] = None
    message: Optional[str] = None
    start_time: Optional[datetime] = None


class CancelCheckResponse(BaseModel):
    """取消检查响应"""
    success: bool
    message: str


class StartCheckResponse(BaseModel):
    """启动检查响应"""
    id: int
    rule_id: int
    status: str
    message: str = "检查任务已创建"
    start_time: datetime


class StartBatchCheckResponse(BaseModel):
    """启动批量检查响应"""
    created_count: int
    results: List[StartCheckResponse]
    message: str = "批量检查任务已创建"

# 快照构建进度追踪器
import json
from typing import Optional, Dict, Any

import redis.asyncio as redis
from app.config import settings


class SnapshotBuildProgressTracker:
    """快照构建进度追踪器"""

    PROGRESS_KEY_PREFIX = "ev_check:snapshot_build:"

    def __init__(self):
        self._redis: Optional[redis.Redis] = None

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
        return self._redis

    def _key(self, task_id: int, suffix: str = "") -> str:
        return f"{self.PROGRESS_KEY_PREFIX}{task_id}{suffix}"

    async def set_initial_progress(
        self,
        task_id: int,
        total_groups: int,
        total_communications: int,
        groups_config: list
    ) -> None:
        """设置初始进度"""
        r = await self._get_redis()
        data = {
            "task_id": task_id,
            "status": "pending",
            "progress": 0,
            "total_groups": total_groups,
            "completed_groups": 0,
            "total_communications": total_communications,
            "completed_communications": 0,
            "current_communication": None,
            "groups_progress": groups_config,
        }
        await r.set(self._key(task_id), json.dumps(data), ex=7200)

    async def update_progress(
        self,
        task_id: int,
        completed_communications: int,
        completed_groups: int,
        current_communication: Optional[str] = None,
        status: str = "running"
    ) -> None:
        """更新进度"""
        r = await self._get_redis()
        data_str = await r.get(self._key(task_id))
        if data_str:
            data = json.loads(data_str)
        else:
            return

        data["completed_communications"] = completed_communications
        data["completed_groups"] = completed_groups
        data["current_communication"] = current_communication
        data["status"] = status

        # 计算总进度
        if data["total_communications"] > 0:
            data["progress"] = int(
                (completed_communications / data["total_communications"]) * 100
            )

        await r.set(self._key(task_id), json.dumps(data), ex=7200)

    async def update_group_status(
        self,
        task_id: int,
        group_id: int,
        status: str,
        communications: list
    ) -> None:
        """更新组状态"""
        r = await self._get_redis()
        data_str = await r.get(self._key(task_id))
        if data_str:
            data = json.loads(data_str)
            for group in data.get("groups_progress", []):
                if group["group_id"] == group_id:
                    group["status"] = status
                    group["communications"] = communications
                    break
            await r.set(self._key(task_id), json.dumps(data), ex=7200)

    async def get_progress(self, task_id: int) -> Optional[Dict[str, Any]]:
        """获取进度"""
        r = await self._get_redis()
        data_str = await r.get(self._key(task_id))
        if data_str:
            return json.loads(data_str)
        return None

    async def clear_progress(self, task_id: int) -> None:
        """清除进度"""
        r = await self._get_redis()
        await r.delete(self._key(task_id))

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()
            self._redis = None


# 全局单例
_progress_tracker: Optional[SnapshotBuildProgressTracker] = None


def get_snapshot_progress_tracker() -> SnapshotBuildProgressTracker:
    global _progress_tracker
    if _progress_tracker is None:
        _progress_tracker = SnapshotBuildProgressTracker()
    return _progress_tracker

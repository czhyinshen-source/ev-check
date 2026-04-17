import asyncio
import json
from typing import Optional

import redis.asyncio as redis

from app.config import settings


class CheckProgressTracker:
    """检查执行进度追踪器 - 基于 Redis 存储检查进度"""

    PROGRESS_KEY_PREFIX = "ev_check:progress:"
    TOTAL_ITEMS_KEY_SUFFIX = ":total"
    COMPLETED_ITEMS_KEY_SUFFIX = ":completed"
    CURRENT_ITEM_KEY_SUFFIX = ":current"

    def __init__(self):
        self._redis: Optional[redis.Redis] = None
        self._loop = None

    async def _get_redis(self) -> redis.Redis:
        """获取 Redis 连接 (线程/循环安全)"""
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            # 如果不在运行的事件循环中，创建一个临时的
            return redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )

        if self._redis is not None:
            if self._loop != current_loop:
                self._redis = None
        
        if self._redis is None:
            self._redis = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=3,
            )
            self._loop = current_loop
        return self._redis

    def _key(self, result_id: int, suffix: str = "") -> str:
        """生成 Redis key"""
        return f"{self.PROGRESS_KEY_PREFIX}{result_id}{suffix}"

    async def set_total_items(self, result_id: int, total: int) -> None:
        """设置检查项总数"""
        r = await self._get_redis()
        await r.set(self._key(result_id, self.TOTAL_ITEMS_KEY_SUFFIX), total)
        await r.set(self._key(result_id, self.COMPLETED_ITEMS_KEY_SUFFIX), 0)
        await r.expire(self._key(result_id, self.TOTAL_ITEMS_KEY_SUFFIX), 7200)
        await r.expire(self._key(result_id, self.COMPLETED_ITEMS_KEY_SUFFIX), 7200)

    async def get_total_items(self, result_id: int) -> int:
        """获取检查项总数"""
        r = await self._get_redis()
        total = await r.get(self._key(result_id, self.TOTAL_ITEMS_KEY_SUFFIX))
        return int(total) if total else 0

    async def increment_completed(self, result_id: int) -> int:
        """增加已完成计数，返回新的计数"""
        r = await self._get_redis()
        count = await r.incr(self._key(result_id, self.COMPLETED_ITEMS_KEY_SUFFIX))
        # 2小时过期
        await r.expire(self._key(result_id, self.COMPLETED_ITEMS_KEY_SUFFIX), 7200)
        return count

    async def get_completed_items(self, result_id: int) -> int:
        """获取已完成计数"""
        r = await self._get_redis()
        count = await r.get(self._key(result_id, self.COMPLETED_ITEMS_KEY_SUFFIX))
        return int(count) if count else 0

    async def set_current_item(self, result_id: int, item_name: str) -> None:
        """设置当前正在检查的项目"""
        r = await self._get_redis()
        await r.set(self._key(result_id, self.CURRENT_ITEM_KEY_SUFFIX), item_name)
        await r.expire(self._key(result_id, self.CURRENT_ITEM_KEY_SUFFIX), 7200)

    async def get_current_item(self, result_id: int) -> Optional[str]:
        """获取当前正在检查的项目"""
        r = await self._get_redis()
        return await r.get(self._key(result_id, self.CURRENT_ITEM_KEY_SUFFIX))

    async def update_progress(
        self,
        result_id: int,
        progress: int,
        message: Optional[str] = None
    ) -> None:
        """
        更新检查进度

        Args:
            result_id: 检查结果ID
            progress: 进度百分比 (0-100)
            message: 进度消息
        """
        r = await self._get_redis()
        data = {
            "progress": min(100, max(0, progress)),
            "message": message or "",
        }
        await r.set(
            self._key(result_id),
            json.dumps(data),
            ex=7200  # 2小时过期
        )

    async def get_progress(self, result_id: int) -> dict:
        """
        获取检查进度

        Returns:
            dict 包含:
                - progress: 进度百分比
                - total_items: 总检查项数
                - completed_items: 已完成检查项数
                - current_item: 当前检查项名称
                - message: 进度消息
        """
        r = await self._get_redis()

        # 获取基本进度
        progress_data = await r.get(self._key(result_id))
        if progress_data:
            data = json.loads(progress_data)
        else:
            data = {"progress": 0, "message": ""}

        # 获取详细信息
        total = await r.get(self._key(result_id, self.TOTAL_ITEMS_KEY_SUFFIX))
        completed = await r.get(self._key(result_id, self.COMPLETED_ITEMS_KEY_SUFFIX))
        current = await r.get(self._key(result_id, self.CURRENT_ITEM_KEY_SUFFIX))

        return {
            "progress": data.get("progress", 0),
            "message": data.get("message", ""),
            "total_items": int(total) if total else 0,
            "completed_items": int(completed) if completed else 0,
            "current_item": current,
        }

    async def clear_progress(self, result_id: int) -> None:
        """清除检查进度数据"""
        r = await self._get_redis()
        keys = [
            self._key(result_id),
            self._key(result_id, self.TOTAL_ITEMS_KEY_SUFFIX),
            self._key(result_id, self.COMPLETED_ITEMS_KEY_SUFFIX),
            self._key(result_id, self.CURRENT_ITEM_KEY_SUFFIX),
        ]
        await r.delete(*keys)

    async def close(self) -> None:
        """关闭 Redis 连接"""
        if self._redis:
            await self._redis.close()
            self._redis = None


# 全局单例
_progress_tracker: Optional[CheckProgressTracker] = None


def get_progress_tracker() -> CheckProgressTracker:
    """获取进度追踪器单例"""
    global _progress_tracker
    if _progress_tracker is None:
        _progress_tracker = CheckProgressTracker()
    return _progress_tracker

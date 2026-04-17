# 检查执行并发锁管理
import asyncio
from typing import Optional

import redis.asyncio as redis

from app.config import settings


class CheckLockManager:
    """检查执行分布式锁管理器 - 确保同一时间只能执行一项检查任务"""

    LOCK_KEY = "ev_check:execution_lock"
    LOCK_TTL = 3600  # 锁超时时间 1 小时

    def __init__(self):
        self._redis: Optional[redis.Redis] = None
        self._loop = None
        self._local_lock: Optional[asyncio.Lock] = None

    async def _get_redis(self) -> redis.Redis:
        """获取 Redis 连接 (线程/循环安全)"""
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            return redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )

        if self._redis is not None:
            if self._loop != current_loop:
                self._redis = None
                self._local_lock = None
        
        if self._redis is None:
            self._redis = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=3,
            )
            self._loop = current_loop
            self._local_lock = asyncio.Lock()
            
        return self._redis

    async def acquire_lock(self, task_id: int) -> bool:
        """
        尝试获取检查执行锁

        Args:
            task_id: 检查结果ID，用于标识锁持有者

        Returns:
            True 表示获取成功，False 表示锁已被占用
        """
        r = await self._get_redis()
        async with self._local_lock:
            # 使用 SET NX EX 原子操作
            result = await r.set(
                self.LOCK_KEY,
                str(task_id),
                nx=True,
                ex=self.LOCK_TTL
            )
            return result is not None

    async def release_lock(self, task_id: int) -> None:
        """
        释放检查执行锁（仅当锁持有者匹配时）

        Args:
            task_id: 检查结果ID
        """
        r = await self._get_redis()
        async with self._local_lock:
            # 使用 Lua 脚本确保原子性：仅当值匹配时删除
            lua_script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            await r.eval(lua_script, 1, self.LOCK_KEY, str(task_id))

    async def is_locked(self) -> bool:
        """检查锁是否被占用"""
        r = await self._get_redis()
        return await r.exists(self.LOCK_KEY) > 0

    async def get_current_task_id(self) -> Optional[int]:
        """获取当前持有锁的任务ID"""
        r = await self._get_redis()
        task_id_str = await r.get(self.LOCK_KEY)
        if task_id_str:
            return int(task_id_str)
        return None

    async def extend_lock(self, task_id: int, additional_seconds: int = 3600) -> bool:
        """
        延长锁的持有时间

        Args:
            task_id: 检查结果ID
            additional_seconds: 延长的秒数

        Returns:
            True 表示延长成功，False 表示锁不属于该任务
        """
        r = await self._get_redis()
        async with self._local_lock:
            # 仅当锁属于该任务时延长
            lua_script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("expire", KEYS[1], ARGV[2])
            else
                return 0
            end
            """
            result = await r.eval(
                lua_script, 1,
                self.LOCK_KEY,
                str(task_id),
                str(additional_seconds)
            )
            return result == 1

    async def force_release_lock(self) -> None:
        """强制释放锁（管理员操作）"""
        r = await self._get_redis()
        await r.delete(self.LOCK_KEY)

    async def close(self) -> None:
        """关闭 Redis 连接"""
        if self._redis:
            await self._redis.close()
            self._redis = None


# 全局单例
_check_lock_manager: Optional[CheckLockManager] = None


def get_check_lock_manager() -> CheckLockManager:
    """获取检查锁管理器单例"""
    global _check_lock_manager
    if _check_lock_manager is None:
        _check_lock_manager = CheckLockManager()
    return _check_lock_manager

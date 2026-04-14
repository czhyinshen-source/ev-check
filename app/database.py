# 数据库连接配置
import hashlib
from typing import AsyncGenerator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    """SQLAlchemy 基类"""
    pass


from sqlalchemy.pool import NullPool

engine_kwargs = {
    "echo": settings.DEBUG,
}

if not settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
    })

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

def create_session_maker(use_null_pool=False):
    """创建会话工厂，可以指定是否使用空连接池（适用于后台任务）"""
    if use_null_pool:
        # 为后台任务创建独立的无池引擎，避免 Loop 冲突
        local_kwargs = engine_kwargs.copy()
        local_kwargs["poolclass"] = NullPool
        # 移除池相关的参数，否则 NullPool 会冲突
        local_kwargs.pop("pool_size", None)
        local_kwargs.pop("max_overflow", None)
        local_kwargs.pop("pool_pre_ping", None)
        
        local_engine = create_async_engine(settings.DATABASE_URL, **local_kwargs)
        return async_sessionmaker(
            local_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        ), local_engine
    
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    ), engine

async_session_maker, _ = create_session_maker()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def hash_password(password: str) -> str:
    """密码哈希"""
    return hashlib.sha256(password.encode()).hexdigest()


async def init_db():
    """初始化数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 创建默认管理员用户
    async with async_session_maker() as session:
        from app.models import User
        result = await session.execute(select(User).where(User.username == "admin"))
        if not result.scalar_one_or_none():
            admin = User(
                username="admin",
                password_hash=hash_password("admin123"),
                role="admin",
                is_active=True,
            )
            session.add(admin)
            await session.commit()
            print("✅ 默认管理员用户已创建 (admin/admin123)")

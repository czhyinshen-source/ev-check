#!/usr/bin/env python3
"""添加 auth_method 字段到 communications 表"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from app.database import async_session_maker


async def migrate():
    """执行数据库迁移"""
    async with async_session_maker() as session:
        try:
            # 检查列是否已存在
            result = await session.execute(text(
                "SHOW COLUMNS FROM communications LIKE 'auth_method'"
            ))
            if result.fetchone():
                print("✅ auth_method 列已存在，无需迁移")
                return

            # 添加 auth_method 列
            print("正在添加 auth_method 列...")
            await session.execute(text(
                "ALTER TABLE communications ADD COLUMN auth_method VARCHAR(20) DEFAULT 'password'"
            ))

            # 为现有数据设置 auth_method（如果有 private_key_path 则设为 private_key）
            print("正在为现有数据设置 auth_method...")
            await session.execute(text(
                "UPDATE communications SET auth_method = 'private_key' WHERE private_key_path IS NOT NULL AND private_key_path != ''"
            ))

            await session.commit()
            print("✅ 迁移完成！")

        except Exception as e:
            await session.rollback()
            print(f"❌ 迁移失败: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(migrate())

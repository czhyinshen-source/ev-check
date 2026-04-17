import asyncio
from sqlalchemy import text
from app.database import engine

async def run():
    async with engine.begin() as conn:
        # 1. 检查版本
        version = (await conn.execute(text('SELECT VERSION()'))).scalar()
        print(f"MySQL Version: {version}")
        
        # 2. 检查现有索引
        print("现有索引:")
        res = await conn.execute(text('SHOW INDEX FROM environment_data'))
        for row in res.all():
            print(f"  {row}")
            
        # 3. 添加缺失的复合索引 (解决 Out of sort memory)
        print("正在添加复合索引以优化排序...")
        
        # 优化 SnapshotInstance 查找
        try:
            await conn.execute(text("ALTER TABLE snapshot_instances ADD INDEX idx_snapshot_comm (snapshot_id, communication_id)"))
            print("✅ idx_snapshot_comm 添加成功")
        except Exception as e:
            print(f"ℹ️ idx_snapshot_comm 跳过: {e}")

        # 优化 EnvironmentData 查找与排序
        # 包含 created_at 允许索引直接覆盖排序
        try:
            await conn.execute(text("ALTER TABLE environment_data ADD INDEX idx_instance_item_created (snapshot_instance_id, check_item_id, created_at)"))
            print("✅ idx_instance_item_created 添加成功")
        except Exception as e:
            print(f"ℹ️ idx_instance_item_created 跳过: {e}")

        try:
            await conn.execute(text("ALTER TABLE environment_data ADD INDEX idx_item_created (check_item_id, created_at)"))
            print("✅ idx_item_created 添加成功")
        except Exception as e:
            print(f"ℹ️ idx_item_created 跳过: {e}")

    print("数据库优化完成！")

if __name__ == "__main__":
    asyncio.run(run())

import asyncio
from sqlalchemy import text
from app.database import engine

async def migrate():
    print("开始数据库增量更新...")
    async with engine.begin() as conn:
        try:
            # 1. 为 snapshot_instances 添加 data_path 字段
            print("正在为 snapshot_instances 添加 data_path 字段...")
            await conn.execute(text("ALTER TABLE snapshot_instances ADD COLUMN data_path VARCHAR(500) DEFAULT NULL"))
            print("✅ snapshot_instances 更新成功")
        except Exception as e:
            if "Duplicate column name" in str(e) or "already exists" in str(e).lower():
                print("ℹ️ snapshot_instances.data_path 字段已存在，跳过")
            else:
                print(f"❌ snapshot_instances 更新失败: {e}")

        try:
            # 2. 为 environment_data 添加 has_file_data 字段
            print("正在为 environment_data 添加 has_file_data 字段...")
            await conn.execute(text("ALTER TABLE environment_data ADD COLUMN has_file_data BOOLEAN DEFAULT FALSE"))
            print("✅ environment_data.has_file_data 添加成功")
        except Exception as e:
            if "Duplicate column name" in str(e) or "already exists" in str(e).lower():
                print("ℹ️ environment_data.has_file_data 字段已存在，跳过")
            else:
                print(f"❌ environment_data.has_file_data 添加失败: {e}")

        try:
            # 3. 将 environment_data.data_value 改为允许为空
            print("正在修改 environment_data.data_value 为允许为空...")
            # 注意: MySQL 中修改字段属性使用 MODIFY
            await conn.execute(text("ALTER TABLE environment_data MODIFY COLUMN data_value JSON NULL"))
            print("✅ environment_data.data_value 修改成功")
        except Exception as e:
            print(f"❌ environment_data.data_value 修改失败: {e}")

    print("数据库增量更新完成！")

if __name__ == "__main__":
    asyncio.run(migrate())

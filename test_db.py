import asyncio
from sqlalchemy import text
from app.database import async_session_maker

async def migrate():
    async with async_session_maker() as session:
        try:
            await session.execute(text("DROP TABLE check_rule_snapshots;"))
            await session.execute(text("DROP TABLE check_rule_check_items;"))
            await session.execute(text("DROP TABLE check_rule_communications;"))
        except Exception as e:
            print("Drop tables error:", e)
        try:
            await session.execute(text("ALTER TABLE check_rules ADD COLUMN execution_targets JSON;"))
            await session.commit()
            print("DB Migration Success!")
        except Exception as e:
            print("Add column error:", e)

asyncio.run(migrate())

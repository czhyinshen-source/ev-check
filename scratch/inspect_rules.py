import asyncio
from app.database import create_session_maker
from app.models import CheckRule
from sqlalchemy import select

async def main():
    session_maker, engine = create_session_maker(use_null_pool=True)
    async with session_maker() as db:
        result = await db.execute(select(CheckRule))
        rules = result.scalars().all()
        print(f"Total rules: {len(rules)}")
        for r in rules:
            print(f"ID: {r.id}, Name: {r.name}, Cron: {r.cron_expression}, Active: {r.is_active}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())

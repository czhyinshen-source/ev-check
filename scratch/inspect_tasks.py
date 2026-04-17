import asyncio
from app.database import create_session_maker
from app.models import ScheduledTask
from sqlalchemy import select

async def main():
    session_maker, engine = create_session_maker(use_null_pool=True)
    async with session_maker() as db:
        result = await db.execute(select(ScheduledTask))
        tasks = result.scalars().all()
        print(f"Total scheduled tasks: {len(tasks)}")
        for t in tasks:
            print(f"ID: {t.id}, Name: {t.name}, IsActive: {t.is_active}, Cron: {t.cron_expression}, LastRun: {t.last_run_at}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())

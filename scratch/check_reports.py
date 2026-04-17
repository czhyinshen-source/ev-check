import asyncio
import datetime
from app.database import create_session_maker
from app.models import CheckReport
from sqlalchemy import select

async def main():
    session_maker, engine = create_session_maker(use_null_pool=True)
    async with session_maker() as db:
        result = await db.execute(select(CheckReport).order_by(CheckReport.id.desc()).limit(10))
        reports = result.scalars().all()
        print(f"Total reports found: {len(reports)}")
        for r in reports:
            print(f"ID: {r.id}, Name: {r.name}, Status: {r.status}, Created: {r.created_at}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())

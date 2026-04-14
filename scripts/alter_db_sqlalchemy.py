import asyncio
from sqlalchemy import text
from app.database import engine

async def alter():
    async with engine.begin() as conn:
        try:
            print("Adding report_id column to check_results...")
            await conn.execute(text("ALTER TABLE check_results ADD COLUMN report_id INTEGER REFERENCES check_reports(id) ON DELETE CASCADE;"))
            print("OK")
        except Exception as e:
            print(f"Error altering table check_results: {e}")
            if "Duplicate column name" in str(e) or "already exists" in str(e).lower():
                print("Column already exists.")

if __name__ == "__main__":
    asyncio.run(alter())

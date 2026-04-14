import asyncio
from app.database import async_session_maker
from sqlalchemy import select
from app.models.check_item import CheckItem

async def main():
    async with async_session_maker() as session:
        result = await session.execute(
            select(CheckItem)
            .where(CheckItem.type == 'file_content')
        )
        items = result.scalars().all()
        for item in items:
            print(f"Item ID: {item.id}, Name: {item.name}, Attrs: {item.check_attributes}")

asyncio.run(main())

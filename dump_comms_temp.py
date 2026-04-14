
import asyncio
from sqlalchemy import select
from app.database import async_session_maker
from app.models import Communication

async def dump_communications():
    async with async_session_maker() as db:
        result = await db.execute(select(Communication))
        comms = result.scalars().all()
        print(f"Total communications: {len(comms)}")
        for comm in comms:
            print(f"ID: {comm.id}, Name: {comm.name}, IP: {comm.ip_address}, AuthMethod: {comm.auth_method}, KeyPath: {comm.private_key_path}")

if __name__ == "__main__":
    asyncio.run(dump_communications())

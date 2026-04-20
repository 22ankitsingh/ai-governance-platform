import asyncio
import os
from sqlalchemy import text
from app.database import async_session_factory

async def add_officer_columns():
    async with async_session_factory() as db:
        await db.execute(text("ALTER TABLE officers ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;"))
        await db.execute(text("ALTER TABLE officers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;"))
        await db.execute(text("ALTER TABLE officers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE;"))
        await db.commit()
        print("Successfully added columns to officers table.")

if __name__ == "__main__":
    asyncio.run(add_officer_columns())

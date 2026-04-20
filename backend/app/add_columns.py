"""
Add new columns to existing tables for the officer system.
Run: python -m app.add_columns
"""
import asyncio
from sqlalchemy import text
from app.database import engine


async def add_columns():
    print("🔄 Adding new columns to existing tables...")

    async with engine.begin() as conn:
        # Add expected_resolution_hours to issue_types
        try:
            await conn.execute(text(
                "ALTER TABLE issue_types ADD COLUMN expected_resolution_hours FLOAT"
            ))
            print("✅ Added issue_types.expected_resolution_hours")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print("ℹ️  issue_types.expected_resolution_hours already exists")
            else:
                print(f"⚠️  issue_types.expected_resolution_hours: {e}")

        # Add officer_id to issues
        try:
            await conn.execute(text(
                "ALTER TABLE issues ADD COLUMN officer_id VARCHAR(36) REFERENCES officers(id)"
            ))
            print("✅ Added issues.officer_id")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print("ℹ️  issues.officer_id already exists")
            else:
                print(f"⚠️  issues.officer_id: {e}")

        # Add assigned_at to issues
        try:
            await conn.execute(text(
                "ALTER TABLE issues ADD COLUMN assigned_at TIMESTAMP"
            ))
            print("✅ Added issues.assigned_at")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print("ℹ️  issues.assigned_at already exists")
            else:
                print(f"⚠️  issues.assigned_at: {e}")

    print("✅ Column migration complete!")


if __name__ == "__main__":
    asyncio.run(add_columns())

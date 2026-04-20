import asyncio
from app.database import async_session_factory
from app.routers.officer import officer_resolve_issue
from app.schemas.officer import OfficerResolveRequest
from sqlalchemy import select
from app.models.officer import Officer
from app.models.issue import Issue
import traceback

async def check():
    async with async_session_factory() as db:
        res = await db.execute(select(Issue).order_by(Issue.created_at.desc()).limit(1))
        issue = res.scalar_one()
        res = await db.execute(select(Officer).where(Officer.id == issue.officer_id))
        officer = res.scalar_one()
        req = OfficerResolveRequest(resolution_notes='Testing locally')
        try:
            await officer_resolve_issue(issue.id, req, officer, db)
            print('Success')
        except Exception as e:
            print('Error occurred:')
            traceback.print_exc()

asyncio.run(check())

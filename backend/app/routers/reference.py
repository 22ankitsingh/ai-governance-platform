from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.models.department import Department
from app.models.issue_type import IssueType
from app.schemas.issue import DepartmentOut
from pydantic import BaseModel
from uuid import UUID
from typing import Optional

router = APIRouter(prefix="/api/reference", tags=["Reference Data"])


class IssueTypeOut(BaseModel):
    id: UUID
    category: str
    subcategory: str
    department_id: Optional[UUID] = None

    class Config:
        from_attributes = True


@router.get("/departments", response_model=List[DepartmentOut])
async def list_departments(db: AsyncSession = Depends(get_db)):
    """Public: list all departments."""
    result = await db.execute(select(Department).where(Department.is_active == True).order_by(Department.name))
    return [DepartmentOut.model_validate(d) for d in result.scalars().all()]


@router.get("/issue-types", response_model=List[IssueTypeOut])
async def list_issue_types(db: AsyncSession = Depends(get_db)):
    """Public: list all issue type categories/subcategories."""
    result = await db.execute(select(IssueType).where(IssueType.is_active == True).order_by(IssueType.category))
    return [IssueTypeOut.model_validate(t) for t in result.scalars().all()]


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Public: list unique categories with their subcategories."""
    result = await db.execute(
        select(IssueType.category, IssueType.subcategory)
        .where(IssueType.is_active == True)
        .order_by(IssueType.category, IssueType.subcategory)
    )
    rows = result.all()

    categories = {}
    for cat, sub in rows:
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(sub)

    return [{"category": k, "subcategories": v} for k, v in categories.items()]

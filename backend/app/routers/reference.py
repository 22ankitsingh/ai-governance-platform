from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.department import Department
from app.models.issue_type import IssueType
from app.schemas.issue import DepartmentOut

router = APIRouter(prefix="/api/reference", tags=["Reference Data"])


class IssueTypeOut(BaseModel):
    id: str
    name: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None

    class Config:
        from_attributes = True


class IssueTypeGroupOut(BaseModel):
    """Department with its associated issue types."""
    department_id: str
    department_name: str
    department_code: str
    issue_types: List[IssueTypeOut]


@router.get("/departments", response_model=List[DepartmentOut])
async def list_departments(db: AsyncSession = Depends(get_db)):
    """Public: list all active departments."""
    result = await db.execute(
        select(Department).where(Department.is_active == True).order_by(Department.name)
    )
    return [DepartmentOut.model_validate(d) for d in result.scalars().all()]


@router.get("/issue-types", response_model=List[IssueTypeOut])
async def list_issue_types(
    department_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Public: list all issue types, optionally filtered by department."""
    query = (
        select(IssueType, Department.name.label("dept_name"))
        .outerjoin(Department, IssueType.department_id == Department.id)
        .where(IssueType.is_active == True)
        .order_by(Department.name, IssueType.name)
    )
    if department_id:
        query = query.where(IssueType.department_id == department_id)

    result = await db.execute(query)
    rows = result.all()

    out = []
    for it, dept_name in rows:
        out.append(IssueTypeOut(
            id=it.id,
            name=it.name,
            department_id=it.department_id,
            department_name=dept_name,
        ))
    return out


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Public: list departments with their issue types grouped together.
    Used by citizen SubmitIssue form for the two-level dropdown.
    Response: [{ department_id, department_name, department_code, issue_types: [...] }]
    """
    # Fetch all departments
    dept_result = await db.execute(
        select(Department).where(Department.is_active == True).order_by(Department.name)
    )
    departments = dept_result.scalars().all()

    # Fetch all active issue types
    it_result = await db.execute(
        select(IssueType).where(IssueType.is_active == True).order_by(IssueType.name)
    )
    issue_types = it_result.scalars().all()

    # Build lookup: dept_id → issue_types
    dept_types: dict[str, list] = {d.id: [] for d in departments}
    for it in issue_types:
        if it.department_id and it.department_id in dept_types:
            dept_types[it.department_id].append({
                "id": it.id,
                "name": it.name,
            })

    return [
        {
            "department_id": d.id,
            "department_name": d.name,
            "department_code": d.code,
            "issue_types": dept_types.get(d.id, []),
        }
        for d in departments
    ]

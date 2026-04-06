from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta

from app.database import get_db
from app.models.user import User
from app.models.issue import Issue
from app.models.ai_prediction import AIPrediction
from app.models.department import Department
from app.models.issue_type import IssueType
from app.middleware.auth import require_admin

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/overview")
async def get_overview(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard overview stats."""
    total = await db.execute(select(func.count(Issue.id)).where(Issue.is_deleted == False))
    total_count = total.scalar() or 0

    resolved = await db.execute(
        select(func.count(Issue.id)).where(
            (Issue.status.in_(["resolved", "closed"])) & (Issue.is_deleted == False)
        )
    )
    resolved_count = resolved.scalar() or 0

    reopened = await db.execute(
        select(func.count(Issue.id)).where(
            (Issue.reopen_count > 0) & (Issue.is_deleted == False)
        )
    )
    reopened_count = reopened.scalar() or 0

    pending = await db.execute(
        select(func.count(Issue.id)).where(
            (Issue.status.in_(["not_assigned", "in_progress", "reopened"])) & (Issue.is_deleted == False)
        )
    )
    pending_count = pending.scalar() or 0

    critical = await db.execute(
        select(func.count(Issue.id)).where(
            (Issue.severity == "critical") & (Issue.is_deleted == False)
        )
    )
    critical_count = critical.scalar() or 0

    # EXTRACT(EPOCH ...) gives seconds; divide by 3600 for hours
    from sqlalchemy import text, cast, Numeric
    avg_time_result = await db.execute(
        select(func.avg(
            func.extract('epoch', Issue.closed_at - Issue.created_at) / 3600.0
        )).where(Issue.closed_at.isnot(None)).where(Issue.is_deleted == False)
    )
    avg_hours_raw = avg_time_result.scalar()
    avg_hours = round(float(avg_hours_raw), 1) if avg_hours_raw else None

    resolution_rate = round((resolved_count / total_count) * 100, 1) if total_count > 0 else 0
    reopen_rate = round((reopened_count / total_count) * 100, 1) if total_count > 0 else 0

    return {
        "total_issues": total_count,
        "resolved_issues": resolved_count,
        "pending_issues": pending_count,
        "reopened_issues": reopened_count,
        "critical_issues": critical_count,
        "resolution_rate": resolution_rate,
        "reopen_rate": reopen_rate,
        "avg_resolution_hours": avg_hours,
    }


@router.get("/by-department")
async def issues_by_department(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Department.name, func.count(Issue.id).label("count"))
        .outerjoin(Issue, (Issue.department_id == Department.id) & (Issue.is_deleted == False))
        .group_by(Department.name)
        .order_by(func.count(Issue.id).desc())
    )
    result = await db.execute(query)
    rows = result.all()
    return [{"department": row[0], "count": row[1]} for row in rows]


@router.get("/by-issue-type")
async def issues_by_issue_type(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Issues grouped by issue_type name, with department."""
    query = (
        select(
            IssueType.name.label("issue_type"),
            Department.name.label("department"),
            func.count(Issue.id).label("count"),
        )
        .join(IssueType, Issue.issue_type_id == IssueType.id)
        .join(Department, IssueType.department_id == Department.id)
        .where(Issue.is_deleted == False)
        .group_by(IssueType.name, Department.name)
        .order_by(func.count(Issue.id).desc())
    )
    result = await db.execute(query)
    rows = result.all()
    return [
        {"issue_type": row[0], "department": row[1], "count": row[2]}
        for row in rows
    ]


@router.get("/by-category")
async def issues_by_category(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Backward-compatible endpoint — now delegates to by-issue-type logic."""
    query = (
        select(IssueType.name.label("category"), func.count(Issue.id).label("count"))
        .join(IssueType, Issue.issue_type_id == IssueType.id)
        .where(Issue.is_deleted == False)
        .group_by(IssueType.name)
        .order_by(func.count(Issue.id).desc())
    )
    result = await db.execute(query)
    rows = result.all()
    return [{"category": row[0], "count": row[1]} for row in rows]


@router.get("/by-status")
async def issues_by_status(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Issue.status, func.count(Issue.id).label("count"))
        .where(Issue.is_deleted == False)
        .group_by(Issue.status)
        .order_by(func.count(Issue.id).desc())
    )
    result = await db.execute(query)
    rows = result.all()
    return [{"status": row[0], "count": row[1]} for row in rows]


@router.get("/by-severity")
async def issues_by_severity(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Issue.severity, func.count(Issue.id).label("count"))
        .where(Issue.is_deleted == False)
        .group_by(Issue.severity)
        .order_by(func.count(Issue.id).desc())
    )
    result = await db.execute(query)
    rows = result.all()
    return [{"severity": row[0], "count": row[1]} for row in rows]


@router.get("/ai-accuracy")
async def ai_accuracy(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """AI prediction accuracy - based on admin feedback (is_ai_correct field on Issue)."""
    # Overall prediction stats
    total_result = await db.execute(
        select(func.count(AIPrediction.id), func.avg(AIPrediction.confidence))
    )
    total_row = total_result.one_or_none()
    total_predictions = total_row[0] if total_row else 0
    avg_conf = round(float(total_row[1]), 2) if total_row and total_row[1] else 0

    # Admin-reviewed issues (is_ai_correct is not NULL)
    reviewed_result = await db.execute(
        select(func.count(Issue.id)).where(
            and_(Issue.is_ai_correct.isnot(None), Issue.is_deleted == False)
        )
    )
    total_reviewed = reviewed_result.scalar() or 0

    # Correct predictions (admin marked True)
    correct_result = await db.execute(
        select(func.count(Issue.id)).where(
            and_(Issue.is_ai_correct == True, Issue.is_deleted == False)
        )
    )
    correct_predictions = correct_result.scalar() or 0

    # Incorrect predictions (admin marked False)
    incorrect_result = await db.execute(
        select(func.count(Issue.id)).where(
            and_(Issue.is_ai_correct == False, Issue.is_deleted == False)
        )
    )
    incorrect_predictions = incorrect_result.scalar() or 0

    accuracy_rate = round((correct_predictions / total_reviewed) * 100, 1) if total_reviewed > 0 else 0

    return {
        "total_predictions": total_predictions,
        "total_reviewed": total_reviewed,
        "correct_predictions": correct_predictions,
        "incorrect_predictions": incorrect_predictions,
        "accuracy_rate": accuracy_rate,
        "avg_confidence": avg_conf,
        "category_matches": correct_predictions,  # legacy compat
    }


@router.get("/geographic")
async def geographic_data(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(
            Issue.latitude, Issue.longitude,
            Issue.severity, Issue.status, Issue.title,
            IssueType.name.label("issue_type"),
        )
        .outerjoin(IssueType, IssueType.id == Issue.issue_type_id)
        .where(and_(
            Issue.latitude.isnot(None),
            Issue.longitude.isnot(None),
            Issue.is_deleted == False,
        ))
    )
    result = await db.execute(query)
    rows = result.all()
    return [
        {
            "lat": row[0], "lng": row[1],
            "severity": row[2], "status": row[3], "title": row[4],
            "issue_type": row[5],
            # For backward compat
            "category": row[5],
        }
        for row in rows
    ]


@router.get("/timeline")
async def issues_timeline(
    days: int = Query(30, ge=7, le=365),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    query = (
        select(
            func.date_trunc('day', Issue.created_at).label("day"),
            func.count(Issue.id).label("count"),
        )
        .where((Issue.created_at >= since) & (Issue.is_deleted == False))
        .group_by(func.date_trunc('day', Issue.created_at))
        .order_by(func.date_trunc('day', Issue.created_at))
    )
    result = await db.execute(query)
    rows = result.all()
    return [{"date": str(row[0])[:10] if row[0] else None, "count": row[1]} for row in rows]

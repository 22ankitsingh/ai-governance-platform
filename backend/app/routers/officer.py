"""
Officer Router — registration, login, profile, issue management, leave toggle.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status, BackgroundTasks
from sqlalchemy import select, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models.officer import Officer
from app.models.issue import Issue
from app.models.issue_media import IssueMedia
from app.models.department import Department
from app.models.status_history import StatusHistory
from app.schemas.officer import (
    OfficerCreate, OfficerLogin, OfficerOut, OfficerTokenResponse,
    OfficerProfileUpdate, OfficerLeaveToggle, OfficerResolveRequest,
)
from app.schemas.issue import IssueDetailOut, IssueListOut, MediaOut
from app.middleware.auth import (
    hash_password, verify_password, create_access_token,
    get_current_officer, require_officer,
)
from app.services.upload_service import upload_image
from app.services.notification_service import create_notification
from app.services.email_service import send_resolution_email_sync
from app.services.assignment_service import release_officer, check_negative_ticket

router = APIRouter(prefix="/api/officer", tags=["Officer"])


def _officer_to_out(officer: Officer) -> OfficerOut:
    """Convert Officer model to OfficerOut schema, resolving department name."""
    data = OfficerOut.model_validate(officer)
    if officer.department:
        data.department_name = officer.department.name
    return data


# ── Auth ────────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=OfficerTokenResponse, status_code=status.HTTP_201_CREATED)
async def officer_register(data: OfficerCreate, db: AsyncSession = Depends(get_db)):
    """Register a new officer account."""
    result = await db.execute(select(Officer).where(Officer.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate department if provided
    if data.department_id:
        dept_result = await db.execute(select(Department).where(Department.id == data.department_id))
        if not dept_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Invalid department_id")

    officer = Officer(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        mobile_number=data.mobile_number,
        department_id=data.department_id,
        designation=data.designation,
    )
    db.add(officer)
    await db.flush()

    # Eagerly load department for the response
    result = await db.execute(
        select(Officer).where(Officer.id == officer.id).options(selectinload(Officer.department))
    )
    officer = result.scalar_one()

    token = create_access_token({"sub": str(officer.id), "role": "officer"})
    return OfficerTokenResponse(
        access_token=token,
        user=_officer_to_out(officer),
    )


@router.post("/login", response_model=OfficerTokenResponse)
async def officer_login(data: OfficerLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate an officer."""
    result = await db.execute(
        select(Officer).where(Officer.email == data.email).options(selectinload(Officer.department))
    )
    officer = result.scalar_one_or_none()

    if not officer or not verify_password(data.password, officer.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if officer.is_deleted:
        raise HTTPException(status_code=403, detail="Your account has been deleted")

    token = create_access_token({"sub": str(officer.id), "role": "officer"})
    return OfficerTokenResponse(
        access_token=token,
        user=_officer_to_out(officer),
    )


@router.get("/me", response_model=OfficerOut)
async def officer_me(
    officer: Officer = Depends(require_officer),
    db: AsyncSession = Depends(get_db),
):
    """Get current officer profile."""
    result = await db.execute(
        select(Officer).where(Officer.id == officer.id).options(selectinload(Officer.department))
    )
    officer = result.scalar_one()
    return _officer_to_out(officer)


@router.delete("/me", status_code=204)
async def delete_officer_me(
    officer: Officer = Depends(require_officer),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete officer account."""
    officer.is_deleted = True
    officer.deleted_at = datetime.utcnow()
    officer.is_available = False
    
    # Reload to get full record
    await db.commit()
    return None


# ── Profile ─────────────────────────────────────────────────────────────────────

@router.put("/me", response_model=OfficerOut)
async def update_profile(
    data: OfficerProfileUpdate,
    officer: Officer = Depends(require_officer),
    db: AsyncSession = Depends(get_db),
):
    """Update officer profile fields."""
    if data.name is not None:
        officer.name = data.name
    if data.mobile_number is not None:
        officer.mobile_number = data.mobile_number
    if data.designation is not None:
        officer.designation = data.designation

    await db.flush()

    result = await db.execute(
        select(Officer).where(Officer.id == officer.id).options(selectinload(Officer.department))
    )
    officer = result.scalar_one()
    return _officer_to_out(officer)


@router.put("/leave", response_model=OfficerOut)
async def toggle_leave(
    data: OfficerLeaveToggle,
    officer: Officer = Depends(require_officer),
    db: AsyncSession = Depends(get_db),
):
    """Toggle officer on-leave status."""
    officer.is_on_leave = data.is_on_leave

    # If going on leave and currently available, they remain available=True
    # but won't be assigned because is_on_leave=True filters them out
    # If coming back from leave and no active issue, ensure available
    if not data.is_on_leave:
        # Check if they have an active issue
        result = await db.execute(
            select(Issue).where(
                Issue.officer_id == officer.id,
                Issue.status == "in_progress",
                Issue.is_deleted == False,
            )
        )
        active_issue = result.scalar_one_or_none()
        if not active_issue:
            officer.is_available = True

    await db.flush()

    result = await db.execute(
        select(Officer).where(Officer.id == officer.id).options(selectinload(Officer.department))
    )
    officer = result.scalar_one()
    return _officer_to_out(officer)


# ── Current Issue ────────────────────────────────────────────────────────────────

def _issue_detail_query(issue_id: str):
    return (
        select(Issue)
        .where((Issue.id == issue_id) & (Issue.is_deleted == False))
        .options(
            selectinload(Issue.reporter),
            selectinload(Issue.department),
            selectinload(Issue.issue_type),
            selectinload(Issue.officer_label),
            selectinload(Issue.officer),
            selectinload(Issue.media),
            selectinload(Issue.ai_predictions),
            selectinload(Issue.verification_votes),
            selectinload(Issue.status_history),
            selectinload(Issue.assignment_history),
        )
    )


@router.get("/current-issue", response_model=Optional[IssueDetailOut])
async def get_current_issue(
    officer: Officer = Depends(require_officer),
    db: AsyncSession = Depends(get_db),
):
    """Get the single active issue assigned to this officer."""
    result = await db.execute(
        select(Issue)
        .where(
            Issue.officer_id == officer.id,
            Issue.status == "in_progress",
            Issue.is_deleted == False,
        )
        .options(
            selectinload(Issue.reporter),
            selectinload(Issue.department),
            selectinload(Issue.issue_type),
            selectinload(Issue.officer_label),
            selectinload(Issue.officer),
            selectinload(Issue.media),
            selectinload(Issue.ai_predictions),
            selectinload(Issue.verification_votes),
            selectinload(Issue.status_history),
            selectinload(Issue.assignment_history),
        )
        .limit(1)
    )
    issue = result.scalar_one_or_none()
    if not issue:
        return None
    return IssueDetailOut.model_validate(issue)


# ── Previous Issues ──────────────────────────────────────────────────────────────

@router.get("/previous-issues", response_model=List[IssueListOut])
async def get_previous_issues(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    officer: Officer = Depends(require_officer),
    db: AsyncSession = Depends(get_db),
):
    """List all past resolved/closed issues assigned to this officer."""
    query = (
        select(Issue)
        .where(
            Issue.officer_id == officer.id,
            Issue.status.in_(["resolved", "closed"]),
            Issue.is_deleted == False,
        )
        .options(
            selectinload(Issue.reporter),
            selectinload(Issue.department),
            selectinload(Issue.issue_type),
            selectinload(Issue.media),
        )
        .order_by(Issue.resolved_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    result = await db.execute(query)
    issues = result.scalars().all()

    out = []
    for issue in issues:
        item = IssueListOut.model_validate(issue)
        item.media_count = len(issue.media) if issue.media else 0
        out.append(item)
    return out


# ── Resolve Issue ────────────────────────────────────────────────────────────────

@router.post("/issues/{issue_id}/resolve", response_model=IssueDetailOut)
async def officer_resolve_issue(
    issue_id: str,
    data: OfficerResolveRequest,
    background_tasks: BackgroundTasks,
    officer: Officer = Depends(require_officer),
    db: AsyncSession = Depends(get_db),
):
    """Officer marks their assigned issue as resolved."""
    result = await db.execute(
        select(Issue).where(
            (Issue.id == issue_id) & (Issue.is_deleted == False)
        )
    )
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.officer_id != officer.id:
        raise HTTPException(status_code=403, detail="This issue is not assigned to you")

    if issue.status != "in_progress":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resolve issue when status is '{issue.status}'. Must be 'in_progress'."
        )

    # Mark resolved
    issue.status = "resolved"
    issue.resolution_notes = data.resolution_notes
    issue.resolved_at = datetime.utcnow()
    issue.updated_at = datetime.utcnow()

    # Status history
    db.add(StatusHistory(
        issue_id=issue.id,
        from_status="in_progress",
        to_status="resolved",
        changed_by=None,
        notes=f"Resolved by officer: {officer.name}. Notes: {data.resolution_notes}",
    ))

    # Check for negative ticket (overdue resolution)
    await check_negative_ticket(issue, officer, db)

    # Release officer
    await release_officer(officer, db)

    # Notify citizen
    await create_notification(
        db, issue.reporter_id,
        title="Please Verify Resolution",
        message=f'Your issue "{issue.title}" has been marked as resolved by officer {officer.name}. Please verify and rate the resolution.',
        notification_type="verification",
        reference_id=issue.id,
    )

    await db.flush()

    # Reload full issue
    result = await db.execute(_issue_detail_query(issue_id))
    issue = result.scalar_one_or_none()

    # Dispatch SMTP email in background (non-blocking)
    if issue and issue.reporter:
        background_tasks.add_task(
            send_resolution_email_sync,
            to_email=issue.reporter.email,
            citizen_name=issue.reporter.full_name,
            issue_title=issue.title,
            issue_description=issue.description or "",
            issue_id=str(issue.id),
            officer_name=issue.officer_name,
            resolution_notes=issue.resolution_notes,
        )

    return IssueDetailOut.model_validate(issue)


# ── Upload After Image ───────────────────────────────────────────────────────────

@router.post("/issues/{issue_id}/after-image", response_model=MediaOut)
async def officer_upload_after_image(
    issue_id: str,
    file: UploadFile = File(...),
    officer: Officer = Depends(require_officer),
    db: AsyncSession = Depends(get_db),
):
    """Officer uploads after-resolution image for their assigned issue."""
    result = await db.execute(
        select(Issue).where((Issue.id == issue_id) & (Issue.is_deleted == False))
    )
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.officer_id != officer.id:
        raise HTTPException(status_code=403, detail="This issue is not assigned to you")

    url = await upload_image(file, folder="resolutions")
    media = IssueMedia(issue_id=issue_id, url=url, media_type="image", upload_phase="after")
    db.add(media)
    await db.flush()
    await db.refresh(media)
    return MediaOut.model_validate(media)


# ── AI Feedback ──────────────────────────────────────────────────────────────────

@router.post("/issues/{issue_id}/ai-feedback", response_model=IssueDetailOut)
async def officer_mark_ai_feedback(
    issue_id: str,
    data: dict,  # { "is_correct": bool }
    officer: Officer = Depends(require_officer),
    db: AsyncSession = Depends(get_db),
):
    """Officer marks whether AI classification was correct or incorrect."""
    result = await db.execute(_issue_detail_query(issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.officer_id != officer.id:
        raise HTTPException(status_code=403, detail="This issue is not assigned to you")

    is_correct = data.get("is_correct")
    if is_correct is not None:
        issue.is_ai_correct = is_correct
        issue.updated_at = datetime.utcnow()
        await db.flush()

    # Reload
    result = await db.execute(_issue_detail_query(issue_id))
    issue = result.scalar_one_or_none()
    return IssueDetailOut.model_validate(issue)


# ── Stats ────────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def officer_stats(
    officer: Officer = Depends(require_officer),
    db: AsyncSession = Depends(get_db),
):
    """Get officer performance stats."""
    from sqlalchemy import func

    # Total resolved
    result = await db.execute(
        select(func.count(Issue.id)).where(
            Issue.officer_id == officer.id,
            Issue.status.in_(["resolved", "closed"]),
            Issue.is_deleted == False,
        )
    )
    total_resolved = result.scalar() or 0

    # Total assigned (all time)
    result = await db.execute(
        select(func.count(Issue.id)).where(
            Issue.officer_id == officer.id,
            Issue.is_deleted == False,
        )
    )
    total_assigned = result.scalar() or 0

    return {
        "total_resolved": total_resolved,
        "total_assigned": total_assigned,
        "avg_rating": officer.avg_rating,
        "total_ratings": officer.total_ratings,
        "negative_tickets": officer.negative_tickets,
        "is_available": officer.is_available,
        "is_on_leave": officer.is_on_leave,
    }

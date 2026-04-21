from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy import select, case, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.issue import Issue
from app.models.issue_type import IssueType
from app.models.issue_media import IssueMedia
from app.models.department import Department
from app.models.officer_label import OfficerLabel
from app.models.officer import Officer
from app.models.status_history import StatusHistory
from app.models.assignment_history import AssignmentHistory
from app.schemas.user import UserOut
from app.schemas.issue import (
    AdminOverride, IssueDetailOut, IssueListOut,
    DepartmentOut, OfficerLabelOut, StatusHistoryOut, AssignmentHistoryOut, MediaOut,
    AssignOfficerRequest, ResolveIssueRequest, AiFeedbackRequest,
)
from app.schemas.officer import OfficerCreate, OfficerOut, OfficerListOut
from app.middleware.auth import require_admin, hash_password
from app.services.upload_service import upload_image
from app.services.notification_service import create_notification
from app.services.email_service import send_resolution_email_sync, send_assignment_email_sync
from app.services.assignment_service import release_officer, check_negative_ticket

router = APIRouter(prefix="/api/admin", tags=["Admin"])

VALID_STATUSES = [
    "not_assigned", "in_progress", "resolved", "closed", "reopened",
]

ALLOWED_TRANSITIONS = {
    "not_assigned": ["in_progress"],
    "in_progress":  ["resolved"],
    "resolved":     ["closed", "reopened"],
    "reopened":     ["in_progress"],
    "closed":       [],  # FINAL
}


def _full_issue_query(issue_id: str):
    """Helper to build a fully-loaded issue query."""
    return select(Issue).where((Issue.id == issue_id) & (Issue.is_deleted == False)).options(
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


async def _resolve_issue_type(
    issue_type_id: Optional[str], db: AsyncSession
) -> Optional[IssueType]:
    if not issue_type_id:
        return None
    result = await db.execute(select(IssueType).where(IssueType.id == issue_type_id))
    it = result.scalar_one_or_none()
    if not it:
        raise HTTPException(status_code=400, detail=f"Invalid issue_type_id: {issue_type_id}")
    return it


@router.get("/issues", response_model=List[IssueListOut])
async def admin_list_issues(
    status: Optional[str] = Query(None),
    issue_type_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    priority: Optional[int] = Query(None),
    min_confidence: Optional[float] = Query(None),
    max_confidence: Optional[float] = Query(None),
    is_irrelevant: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: list all issues with advanced filters."""
    query = select(Issue).where(Issue.is_deleted == False).options(
        selectinload(Issue.reporter),
        selectinload(Issue.department),
        selectinload(Issue.issue_type),
        selectinload(Issue.media),
    )

    if status:
        query = query.where(Issue.status == status)
    if issue_type_id:
        query = query.where(Issue.issue_type_id == issue_type_id)
    if department_id:
        query = query.where(Issue.department_id == department_id)
    if severity:
        query = query.where(Issue.severity == severity)
    if priority:
        query = query.where(Issue.priority == priority)
    if min_confidence is not None:
        query = query.where(Issue.ai_confidence >= min_confidence)
    if max_confidence is not None:
        query = query.where(Issue.ai_confidence <= max_confidence)
    if is_irrelevant is not None:
        query = query.where(Issue.is_irrelevant == is_irrelevant)
    if search:
        query = query.where(Issue.title.ilike(f"%{search}%"))

    query = query.order_by(
        case(
            (Issue.status == "closed", 1),
            else_=0
        ).asc(),
        Issue.priority.asc(),
        Issue.updated_at.desc()
    )
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    issues = result.scalars().all()

    out = []
    for issue in issues:
        item = IssueListOut.model_validate(issue)
        item.media_count = len(issue.media) if issue.media else 0
        out.append(item)
    return out


@router.get("/issues/{issue_id}", response_model=IssueDetailOut)
async def admin_get_issue(
    issue_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: get full issue detail."""
    result = await db.execute(_full_issue_query(issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    return IssueDetailOut.model_validate(issue)


@router.put("/issues/{issue_id}", response_model=IssueDetailOut)
async def admin_update_issue(
    issue_id: str,
    data: AdminOverride,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: override issue type, severity, priority, department.
    Status changes are NOT allowed through this endpoint — use /assign or /resolve.
    If issue_type_id is provided, department_id is auto-assigned from it.
    """
    query = _full_issue_query(issue_id)
    result = await db.execute(query)
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.status == "closed":
        raise HTTPException(status_code=400, detail="Closed issues cannot be modified")

    old_status = issue.status
    assignment_changed = False

    # Issue type update — auto-assigns department
    if data.issue_type_id is not None:
        it = await _resolve_issue_type(data.issue_type_id, db)
        if it:
            issue.issue_type_id = it.id
            issue.department_id = it.department_id
            issue.category = it.name   # keep legacy field in sync
            assignment_changed = True
        else:
            issue.issue_type_id = None
    elif data.department_id is not None:
        # Fall back to manual department override if no issue_type_id
        issue.department_id = data.department_id if data.department_id else None
        assignment_changed = True

    if data.severity is not None:
        issue.severity = data.severity
    if data.priority is not None:
        issue.priority = data.priority
    if data.resolution_notes is not None:
        issue.resolution_notes = data.resolution_notes
    if data.is_irrelevant is not None:
        issue.is_irrelevant = data.is_irrelevant

    # Status change — only valid transitions
    if data.status is not None and data.status != old_status:
        if data.status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {VALID_STATUSES}")

        allowed = ALLOWED_TRANSITIONS.get(old_status, [])
        if data.status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid transition from '{old_status}' to '{data.status}'. Allowed: {allowed}"
            )

        issue.status = data.status
        if data.status == "resolved":
            issue.resolved_at = datetime.utcnow()
        if data.status == "closed":
            issue.closed_at = datetime.utcnow()

        db.add(StatusHistory(
            issue_id=issue.id,
            from_status=old_status,
            to_status=data.status,
            changed_by=admin.id,
            notes=data.notes,
        ))

        await create_notification(
            db, issue.reporter_id,
            title=f"Issue Status Updated: {data.status.replace('_', ' ').title()}",
            message=f'Your issue "{issue.title}" status changed from {old_status} to {data.status}.',
            notification_type="status_change",
            reference_id=issue.id,
        )

        if data.status == "resolved":
            await create_notification(
                db, issue.reporter_id,
                title="Please Verify Resolution",
                message=f'Your issue "{issue.title}" has been marked as resolved. Please verify and rate the resolution.',
                notification_type="verification",
                reference_id=issue.id,
            )

    if assignment_changed:
        db.add(AssignmentHistory(
            issue_id=issue.id,
            assigned_by=admin.id,
            department_id=issue.department_id,
            officer_name=issue.officer_name,
            notes=data.notes,
        ))

    issue.updated_at = datetime.utcnow()
    await db.flush()

    result = await db.execute(_full_issue_query(issue_id))
    issue = result.scalar_one_or_none()

    return IssueDetailOut.model_validate(issue)


@router.post("/issues/{issue_id}/assign", response_model=IssueDetailOut)
async def assign_officer(
    issue_id: str,
    data: AssignOfficerRequest,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: assign an officer to an issue. Supports real officer_id or legacy officer_name."""
    query = _full_issue_query(issue_id)
    result = await db.execute(query)
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.status not in ("not_assigned", "reopened"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot assign officer when status is '{issue.status}'. Must be 'not_assigned' or 'reopened'."
        )

    old_status = issue.status
    assigned_officer = None
    officer_display_name = data.officer_name or "Unknown"

    # Real officer assignment (preferred)
    if data.officer_id:
        result = await db.execute(select(Officer).where(Officer.id == data.officer_id))
        assigned_officer = result.scalar_one_or_none()
        if not assigned_officer:
            raise HTTPException(status_code=400, detail="Officer not found")
        if not assigned_officer.is_available:
            raise HTTPException(status_code=400, detail="Officer is currently unavailable (already assigned)")
        if assigned_officer.is_on_leave:
            raise HTTPException(status_code=400, detail="Officer is currently on leave")

        issue.officer_id = assigned_officer.id
        issue.officer_name = assigned_officer.name
        issue.assigned_at = datetime.utcnow()
        assigned_officer.is_available = False
        officer_display_name = assigned_officer.name
    else:
        # Legacy name-only assignment
        issue.officer_name = data.officer_name

    issue.status = "in_progress"
    issue.updated_at = datetime.utcnow()

    db.add(StatusHistory(
        issue_id=issue.id, from_status=old_status, to_status="in_progress",
        changed_by=admin.id,
        notes=data.notes or f"Officer assigned: {officer_display_name}",
    ))

    db.add(AssignmentHistory(
        issue_id=issue.id, assigned_by=admin.id,
        department_id=issue.department_id,
        officer_name=officer_display_name,
        notes=data.notes or f"Officer assigned by admin: {officer_display_name}",
    ))

    await create_notification(
        db, issue.reporter_id,
        title="Officer Assigned to Your Issue",
        message=f'Officer "{officer_display_name}" has been assigned to your issue "{issue.title}". Status is now In Progress.',
        notification_type="status_change",
        reference_id=issue.id,
    )

    await db.flush()

    if assigned_officer:
        background_tasks.add_task(
            send_assignment_email_sync,
            to_email=assigned_officer.email,
            officer_name=assigned_officer.name,
            issue_title=issue.title,
            issue_description=issue.description or "",
            issue_id=str(issue.id),
            issue_location=issue.address or issue.context or "",
            assigned_time=issue.assigned_at.strftime("%Y-%m-%d %H:%M:%S") if issue.assigned_at else "",
        )

    result = await db.execute(query)
    issue = result.scalar_one_or_none()
    return IssueDetailOut.model_validate(issue)


@router.post("/issues/{issue_id}/resolve", response_model=IssueDetailOut)
async def resolve_issue(
    issue_id: str,
    data: ResolveIssueRequest,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: mark an issue as resolved. Only when status is in_progress."""
    query = _full_issue_query(issue_id)
    result = await db.execute(query)
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.status != "in_progress":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resolve issue when status is '{issue.status}'. Must be 'in_progress'."
        )

    issue.status = "resolved"
    issue.resolution_notes = data.resolution_notes
    issue.resolved_at = datetime.utcnow()
    issue.updated_at = datetime.utcnow()

    db.add(StatusHistory(
        issue_id=issue.id, from_status="in_progress", to_status="resolved",
        changed_by=admin.id,
        notes=data.notes or f"Issue resolved. Notes: {data.resolution_notes}",
    ))

    # Release assigned officer and check for negative ticket
    if issue.officer_id:
        officer_result = await db.execute(select(Officer).where(Officer.id == issue.officer_id))
        assigned_officer = officer_result.scalar_one_or_none()
        if assigned_officer:
            await check_negative_ticket(issue, assigned_officer, db)
            await release_officer(assigned_officer, db)

    await create_notification(
        db, issue.reporter_id,
        title="Please Verify Resolution",
        message=f'Your issue "{issue.title}" has been marked as resolved. Please verify and rate the resolution.',
        notification_type="verification",
        reference_id=issue.id,
    )

    await db.flush()

    # --- Reload full issue (includes reporter relation with email) ---
    result = await db.execute(query)
    issue = result.scalar_one_or_none()

    # --- Dispatch SMTP email in background (non-blocking) ---
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


@router.post("/issues/{issue_id}/ai-feedback", response_model=IssueDetailOut)
async def mark_ai_feedback(
    issue_id: str,
    data: AiFeedbackRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: mark whether AI classification was correct or incorrect for an issue."""
    result = await db.execute(_full_issue_query(issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue.is_ai_correct = data.is_correct
    issue.updated_at = datetime.utcnow()
    await db.flush()

    result = await db.execute(_full_issue_query(issue_id))
    issue = result.scalar_one_or_none()
    return IssueDetailOut.model_validate(issue)


@router.post("/issues/{issue_id}/after-image", response_model=MediaOut)
async def upload_after_image(
    issue_id: str,
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: upload after-resolution image."""
    result = await db.execute(select(Issue).where((Issue.id == issue_id) & (Issue.is_deleted == False)))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    url = await upload_image(file, folder="resolutions")
    media = IssueMedia(issue_id=issue_id, url=url, media_type="image", upload_phase="after")
    db.add(media)
    await db.flush()
    await db.refresh(media)
    return MediaOut.model_validate(media)


@router.get("/departments", response_model=List[DepartmentOut])
async def list_departments(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Department).where(Department.is_active == True).order_by(Department.name))
    return [DepartmentOut.model_validate(d) for d in result.scalars().all()]


@router.get("/officers", response_model=List[OfficerLabelOut])
async def list_officers(
    department_id: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(OfficerLabel).where(OfficerLabel.is_active == True)
    if department_id:
        query = query.where(OfficerLabel.department_id == department_id)
    result = await db.execute(query.order_by(OfficerLabel.name))
    return [OfficerLabelOut.model_validate(o) for o in result.scalars().all()]


@router.get("/audit-log", response_model=List[StatusHistoryOut])
async def get_audit_log(
    issue_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: get audit log of all status changes."""
    query = select(StatusHistory)
    if issue_id:
        query = query.where(StatusHistory.issue_id == issue_id)
    query = query.order_by(StatusHistory.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    return [StatusHistoryOut.model_validate(s) for s in result.scalars().all()]


@router.get("/users", response_model=List[UserOut])
async def list_users(
    search: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: list all citizen users."""
    query = select(User).where((User.role == "citizen") & (User.is_deleted == False))

    if search:
        query = query.where(
            (User.full_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )

    query = query.order_by(User.created_at.desc())
    result = await db.execute(query)
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
):
    """Admin: delete a user (Disabled)."""
    raise HTTPException(status_code=403, detail="Admin is not permitted to delete users")


# ─────────────────────────────────────────────────────────────────────────────
# OFFICER MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/real-officers", response_model=List[OfficerListOut])
async def list_real_officers(
    department_id: Optional[str] = Query(None),
    available_only: Optional[bool] = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: list all registered officers with optional filters."""
    query = select(Officer).options(selectinload(Officer.department))
    if department_id:
        query = query.where(Officer.department_id == department_id)
    if available_only is True:
        query = query.where(Officer.is_available == True, Officer.is_on_leave == False)
    query = query.order_by(Officer.name)

    result = await db.execute(query)
    officers = result.scalars().all()

    out = []
    for o in officers:
        item = OfficerListOut.model_validate(o)
        if o.department:
            item.department_name = o.department.name
        out.append(item)
    return out


@router.post("/real-officers", response_model=OfficerOut, status_code=201)
async def admin_create_officer(
    data: OfficerCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: create a new officer account."""
    result = await db.execute(select(Officer).where(Officer.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

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

    result = await db.execute(
        select(Officer).where(Officer.id == officer.id).options(selectinload(Officer.department))
    )
    officer = result.scalar_one()

    out = OfficerOut.model_validate(officer)
    if officer.department:
        out.department_name = officer.department.name
    return out


@router.get("/officer-stats")
async def admin_officer_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: get aggregate officer stats."""
    total = await db.execute(select(func.count(Officer.id)))
    available = await db.execute(
        select(func.count(Officer.id)).where(Officer.is_available == True, Officer.is_on_leave == False)
    )
    on_leave = await db.execute(
        select(func.count(Officer.id)).where(Officer.is_on_leave == True)
    )
    busy = await db.execute(
        select(func.count(Officer.id)).where(Officer.is_available == False, Officer.is_on_leave == False)
    )

    return {
        "total_officers": total.scalar() or 0,
        "available": available.scalar() or 0,
        "on_leave": on_leave.scalar() or 0,
        "busy": busy.scalar() or 0,
    }

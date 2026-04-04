from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy import select, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.issue import Issue
from app.models.issue_media import IssueMedia
from app.models.department import Department
from app.models.officer_label import OfficerLabel
from app.models.status_history import StatusHistory
from app.models.assignment_history import AssignmentHistory
from app.schemas.user import UserOut
from app.schemas.issue import (
    AdminOverride, IssueDetailOut, IssueListOut,
    DepartmentOut, OfficerLabelOut, StatusHistoryOut, AssignmentHistoryOut, MediaOut,
    AssignOfficerRequest, ResolveIssueRequest,
)
from app.middleware.auth import require_admin
from app.services.upload_service import upload_image
from app.services.notification_service import create_notification

router = APIRouter(prefix="/api/admin", tags=["Admin"])

VALID_STATUSES = [
    "not_assigned", "in_progress", "resolved", "closed", "reopened",
]

# Strict status transition map — defines which transitions are allowed
ALLOWED_TRANSITIONS = {
    "not_assigned": ["in_progress"],
    "in_progress": ["resolved"],
    "resolved": ["closed", "reopened"],
    "reopened": ["in_progress"],
    "closed": [],  # FINAL — no transitions allowed
}


def _full_issue_query(issue_id: str):
    """Helper to build a fully-loaded issue query."""
    return select(Issue).where((Issue.id == issue_id) & (Issue.is_deleted == False)).options(
        selectinload(Issue.reporter),
        selectinload(Issue.department),
        selectinload(Issue.officer_label),
        selectinload(Issue.media),
        selectinload(Issue.ai_predictions),
        selectinload(Issue.verification_votes),
        selectinload(Issue.status_history),
        selectinload(Issue.assignment_history),
    )


@router.get("/issues", response_model=List[IssueListOut])
async def admin_list_issues(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    priority: Optional[int] = Query(None),
    min_confidence: Optional[float] = Query(None),
    max_confidence: Optional[float] = Query(None),
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
        selectinload(Issue.media),
    )

    if status:
        query = query.where(Issue.status == status)
    if category:
        query = query.where(Issue.category == category)
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
    """Admin: override AI predictions, update category/severity/priority/department.
    Status changes are NOT allowed through this endpoint — use /assign or /resolve instead.
    """
    query = _full_issue_query(issue_id)
    result = await db.execute(query)
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Closed issues cannot be modified
    if issue.status == "closed":
        raise HTTPException(status_code=400, detail="Closed issues cannot be modified")

    # Track changes
    old_status = issue.status
    assignment_changed = False

    if data.category is not None:
        issue.category = data.category
    if data.severity is not None:
        issue.severity = data.severity
    if data.priority is not None:
        issue.priority = data.priority
    if data.resolution_notes is not None:
        issue.resolution_notes = data.resolution_notes

    if data.department_id is not None:
        issue.department_id = data.department_id if data.department_id else None
        assignment_changed = True

    # Status change through general update is still supported for backward compatibility
    # but only valid transitions are allowed
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

        # Notify citizen of status change
        await create_notification(
            db, issue.reporter_id,
            title=f"Issue Status Updated: {data.status.replace('_', ' ').title()}",
            message=f'Your issue "{issue.title}" status changed from {old_status} to {data.status}.',
            notification_type="status_change",
            reference_id=issue.id,
        )

        # Special notification for resolved — prompt verification
        if data.status == "resolved":
            await create_notification(
                db, issue.reporter_id,
                title="Please Verify Resolution",
                message=f'Your issue "{issue.title}" has been marked as resolved. Please verify and rate the resolution.',
                notification_type="verification",
                reference_id=issue.id,
            )

    # Assignment history
    if assignment_changed:
        db.add(AssignmentHistory(
            issue_id=issue.id,
            assigned_by=admin.id,
            department_id=data.department_id or issue.department_id,
            officer_name=issue.officer_name,
            notes=data.notes,
        ))

    issue.updated_at = datetime.utcnow()
    await db.flush()

    # Re-fetch with all relations
    result = await db.execute(query)
    issue = result.scalar_one_or_none()

    return IssueDetailOut.model_validate(issue)


@router.post("/issues/{issue_id}/assign", response_model=IssueDetailOut)
async def assign_officer(
    issue_id: str,
    data: AssignOfficerRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: assign an officer to an issue. Only allowed when status is not_assigned or reopened.
    Automatically transitions status to in_progress.
    """
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
    issue.officer_name = data.officer_name
    issue.status = "in_progress"
    issue.updated_at = datetime.utcnow()

    # Status history
    db.add(StatusHistory(
        issue_id=issue.id,
        from_status=old_status,
        to_status="in_progress",
        changed_by=admin.id,
        notes=data.notes or f"Officer assigned: {data.officer_name}",
    ))

    # Assignment history
    db.add(AssignmentHistory(
        issue_id=issue.id,
        assigned_by=admin.id,
        department_id=issue.department_id,
        officer_name=data.officer_name,
        notes=data.notes or f"Officer assigned: {data.officer_name}",
    ))

    # Notify citizen
    await create_notification(
        db, issue.reporter_id,
        title="Officer Assigned to Your Issue",
        message=f'Officer "{data.officer_name}" has been assigned to your issue "{issue.title}". Status is now In Progress.',
        notification_type="status_change",
        reference_id=issue.id,
    )

    await db.flush()

    # Re-fetch
    result = await db.execute(query)
    issue = result.scalar_one_or_none()
    return IssueDetailOut.model_validate(issue)


@router.post("/issues/{issue_id}/resolve", response_model=IssueDetailOut)
async def resolve_issue(
    issue_id: str,
    data: ResolveIssueRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: mark an issue as resolved. Only allowed when status is in_progress."""
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

    # Status history
    db.add(StatusHistory(
        issue_id=issue.id,
        from_status="in_progress",
        to_status="resolved",
        changed_by=admin.id,
        notes=data.notes or f"Issue resolved. Notes: {data.resolution_notes}",
    ))

    # Notify citizen to verify
    await create_notification(
        db, issue.reporter_id,
        title="Please Verify Resolution",
        message=f'Your issue "{issue.title}" has been marked as resolved. Please verify and rate the resolution.',
        notification_type="verification",
        reference_id=issue.id,
    )

    await db.flush()

    # Re-fetch
    result = await db.execute(query)
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
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: list all users."""
    query = select(User)
    
    if role and role != "all":
        query = query.where(User.role == role)
    elif not role:
        query = query.where(User.role == "citizen")
        
    if search:
        query = query.where(
            (User.full_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )
        
    query = query.order_by(User.created_at.desc())
    result = await db.execute(query)
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: delete a user."""
    # Prevent self-deletion
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    await db.delete(user)
    await db.commit()
    return None

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.issue import Issue
from app.models.issue_type import IssueType
from app.models.issue_media import IssueMedia
from app.models.ai_prediction import AIPrediction
from app.models.verification_vote import VerificationVote
from app.models.status_history import StatusHistory
from app.schemas.issue import (
    IssueCreate, IssueOut, IssueListOut, IssueDetailOut,
    VerificationVoteCreate, MediaOut, VerificationVoteOut,
)
from app.middleware.auth import get_current_user
from app.services.ai_service import analyze_issue
from app.services.upload_service import upload_image
from app.services.notification_service import create_notification

router = APIRouter(prefix="/api/issues", tags=["Issues"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _full_citizen_query(issue_id: str):
    return (
        select(Issue)
        .where((Issue.id == issue_id) & (Issue.is_deleted == False))
        .options(
            selectinload(Issue.reporter),
            selectinload(Issue.department),
            selectinload(Issue.issue_type),
            selectinload(Issue.officer_label),
            selectinload(Issue.media),
            selectinload(Issue.ai_predictions),
            selectinload(Issue.verification_votes),
            selectinload(Issue.status_history),
            selectinload(Issue.assignment_history),
        )
    )


async def _resolve_issue_type(
    issue_type_id: Optional[str], db: AsyncSession
) -> Optional[IssueType]:
    """Fetch IssueType by id; raises 400 if id provided but not found."""
    if not issue_type_id:
        return None
    result = await db.execute(
        select(IssueType).where(IssueType.id == issue_type_id)
    )
    it = result.scalar_one_or_none()
    if not it:
        raise HTTPException(status_code=400, detail=f"Invalid issue_type_id: {issue_type_id}")
    return it


async def _get_issue_type_by_name(name: str, db: AsyncSession) -> Optional[IssueType]:
    """Look up issue type by its name string (from AI result)."""
    result = await db.execute(
        select(IssueType).where(IssueType.name == name)
    )
    return result.scalar_one_or_none()


# ─────────────────────────────────────────────────────────────────────────────
@router.post("", response_model=IssueOut, status_code=201)
async def create_issue(
    title: str = Form(...),
    description: str = Form(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    address: Optional[str] = Form(None),
    context: Optional[str] = Form(None),
    issue_type_id: Optional[str] = Form(None),   # NEW: citizen can pre-select
    # Legacy field kept for backward compatibility — ignored if issue_type_id set
    category: Optional[str] = Form(None),

    images: List[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new issue with optional image uploads.
    
    Accepts issue_type_id (preferred) or lets AI auto-classify.
    Department is always auto-assigned from the issue_type.
    Issue creation NEVER fails due to AI errors.
    """
    # Validate issue_type_id if provided
    issue_type_obj: Optional[IssueType] = None
    if issue_type_id:
        issue_type_obj = await _resolve_issue_type(issue_type_id, db)

    issue = Issue(
        title=title,
        description=description,
        latitude=latitude,
        longitude=longitude,
        address=address,
        context=context,
        issue_type_id=issue_type_obj.id if issue_type_obj else None,
        department_id=issue_type_obj.department_id if issue_type_obj else None,
        category=issue_type_obj.name if issue_type_obj else None,
        reporter_id=current_user.id,
        status="not_assigned",
    )
    db.add(issue)
    await db.flush()

    # Upload images
    uploaded_urls = []
    for img in images:
        if img.filename:
            url = await upload_image(img, folder="issues")
            media = IssueMedia(issue_id=issue.id, url=url, upload_phase="before")
            db.add(media)
            uploaded_urls.append(url)

    # ── AI Analysis ────────────────────────────────────────────────────────
    image_url = uploaded_urls[0] if uploaded_urls else None
    ai_result = await analyze_issue(title, description, image_url)

    # Look up issue_type in DB from AI output (if not already set by user)
    ai_issue_type_name = ai_result.get("issue_type", "")
    if not issue_type_obj and ai_issue_type_name:
        issue_type_obj = await _get_issue_type_by_name(ai_issue_type_name, db)
        if issue_type_obj:
            issue.issue_type_id = issue_type_obj.id
            issue.department_id = issue_type_obj.department_id
            issue.category = issue_type_obj.name

    # Save AI prediction record using predicted_category for compatibility
    prediction = AIPrediction(
        issue_id=issue.id,
        predicted_category=ai_result.get("issue_type"),          # stores issue_type name
        predicted_department=ai_result.get("department"),
        predicted_severity=ai_result.get("predicted_severity"),
        predicted_priority=ai_result.get("predicted_priority"),
        confidence=ai_result.get("confidence"),
        reasoning=ai_result.get("reasoning"),
        model_version=ai_result.get("model_version"),
        raw_response=ai_result.get("raw_response"),
    )
    db.add(prediction)

    # Apply AI severity/priority to issue
    issue.ai_confidence = ai_result.get("confidence")
    issue.ai_reasoning = ai_result.get("reasoning")
    issue.severity = ai_result.get("predicted_severity", "medium")
    issue.priority = ai_result.get("predicted_priority", 3)

    # Status history
    db.add(StatusHistory(
        issue_id=issue.id,
        from_status=None,
        to_status="not_assigned",
        changed_by=current_user.id,
        notes="Issue created",
    ))

    await db.flush()
    await db.refresh(issue)

    return IssueOut.model_validate(issue)


# ─────────────────────────────────────────────────────────────────────────────
@router.get("", response_model=List[IssueListOut])
async def list_issues(
    status: Optional[str] = Query(None),
    issue_type_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List issues — citizens see their own, admins see all."""
    query = select(Issue).where(Issue.is_deleted == False).options(
        selectinload(Issue.reporter),
        selectinload(Issue.department),
        selectinload(Issue.issue_type),
        selectinload(Issue.media),
    )

    if current_user.role == "citizen":
        query = query.where(Issue.reporter_id == current_user.id)

    if status:
        query = query.where(Issue.status == status)
    if issue_type_id:
        query = query.where(Issue.issue_type_id == issue_type_id)
    if department_id:
        query = query.where(Issue.department_id == department_id)
    if severity:
        query = query.where(Issue.severity == severity)

    query = query.order_by(
        case(
            (Issue.status == "closed", 1),
            else_=0
        ).asc(),
        Issue.updated_at.desc()
    )
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    issues = result.scalars().all()

    out = []
    for issue in issues:
        item = IssueListOut.model_validate(issue)
        item.media_count = len(issue.media) if issue.media else 0
        if current_user.role == "citizen":
            item.ai_confidence = None
            item.ai_reasoning = None
        out.append(item)
    return out


# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{issue_id}", response_model=IssueDetailOut)
async def get_issue(
    issue_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full issue detail with all related data."""
    result = await db.execute(_full_citizen_query(issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Citizens can only view their own issues
    if current_user.role == "citizen" and issue.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    out = IssueDetailOut.model_validate(issue)
    if current_user.role == "citizen":
        out.ai_confidence = None
        out.ai_reasoning = None
        out.ai_predictions = []

    return out


# ─────────────────────────────────────────────────────────────────────────────
@router.post("/{issue_id}/verify", response_model=IssueDetailOut)
async def verify_issue(
    issue_id: str,
    data: VerificationVoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Citizen verifies a resolved issue — can approve or reject."""
    result = await db.execute(select(Issue).where((Issue.id == issue_id) & (Issue.is_deleted == False)))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the reporter can verify")

    if issue.status == "closed":
        raise HTTPException(status_code=400, detail="Issue is already closed and cannot be modified")

    if issue.status != "resolved":
        raise HTTPException(status_code=400, detail="Issue must be in 'resolved' status to verify")

    # Create vote
    vote = VerificationVote(
        issue_id=issue_id,
        voter_id=current_user.id,
        approved=data.approved,
        rating=data.rating,
        feedback=data.feedback,
        rejection_reason=data.rejection_reason,
    )
    db.add(vote)

    issue.citizen_rating = data.rating
    issue.citizen_feedback = data.feedback

    old_status = issue.status
    if data.approved:
        issue.status = "closed"
        issue.closed_at = datetime.utcnow()
        db.add(StatusHistory(
            issue_id=issue.id, from_status=old_status, to_status="closed",
            changed_by=current_user.id,
            notes=f"Citizen verified and approved. Rating: {data.rating}/5" if data.rating else "Citizen verified and approved."
        ))
    else:
        issue.status = "reopened"
        issue.reopen_count += 1
        issue.priority = max(1, issue.priority - 1)
        issue.resolved_at = None
        issue.officer_name = None
        db.add(StatusHistory(
            issue_id=issue.id, from_status=old_status, to_status="reopened",
            changed_by=current_user.id,
            notes=f"Citizen rejected resolution. Reason: {data.rejection_reason or 'Not satisfied'}. Priority increased. Officer cleared for reassignment."
        ))

    await db.flush()

    # Re-fetch full detail
    result = await db.execute(_full_citizen_query(issue_id))
    issue = result.scalar_one_or_none()

    out = IssueDetailOut.model_validate(issue)
    out.ai_confidence = None
    out.ai_reasoning = None
    out.ai_predictions = []
    return out


# ─────────────────────────────────────────────────────────────────────────────
@router.post("/{issue_id}/upload", response_model=MediaOut)
async def upload_issue_media(
    issue_id: str,
    file: UploadFile = File(...),
    upload_phase: str = Form("before"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload additional media to an issue."""
    result = await db.execute(select(Issue).where((Issue.id == issue_id) & (Issue.is_deleted == False)))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    url = await upload_image(file, folder="issues")
    media = IssueMedia(issue_id=issue_id, url=url, upload_phase=upload_phase)
    db.add(media)
    await db.flush()
    await db.refresh(media)
    return MediaOut.model_validate(media)


# ─────────────────────────────────────────────────────────────────────────────
@router.delete("/{issue_id}", status_code=204)
async def delete_issue(
    issue_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete an issue. Only the reporter or an admin can delete it."""
    result = await db.execute(select(Issue).where(Issue.id == issue_id))
    issue = result.scalar_one_or_none()

    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if current_user.role != "admin" and issue.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this issue")

    issue.is_deleted = True
    issue.deleted_at = datetime.utcnow()
    await db.commit()
    return None

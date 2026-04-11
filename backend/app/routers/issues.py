from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.issue import Issue
from app.models.department import Department
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
from app.services.ai_service import analyze_issue, infer_department
from app.services.upload_service import upload_image
from app.services.geo_service import reverse_geocode
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
    result = await db.execute(select(IssueType).where(IssueType.id == issue_type_id))
    it = result.scalar_one_or_none()
    if not it:
        raise HTTPException(status_code=400, detail=f"Invalid issue_type_id: {issue_type_id}")
    return it


async def _get_issue_type_by_name(name: str, db: AsyncSession) -> Optional[IssueType]:
    """Look up predefined IssueType by exact name (case-sensitive)."""
    result = await db.execute(select(IssueType).where(IssueType.name == name))
    return result.scalar_one_or_none()


async def _get_department_by_name(name: str, db: AsyncSession) -> Optional[Department]:
    """Look up Department by exact name."""
    result = await db.execute(select(Department).where(Department.name == name))
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
    issue_type_id: Optional[str] = Form(None),
    # Legacy field — ignored if issue_type_id set
    category: Optional[str] = Form(None),

    images: List[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new civic issue with optional images.

    Pipeline:
    1. Validate pre-selected issue_type_id (if provided)
    2. Upload images (Cloudinary / local)
    3. Reverse geocode lat/lng → address + area_type
    4. AI analysis (Gemini 2.5 Flash or keyword fallback) with:
       - title, description
       - image (multimodal if uploaded)
       - address, area_type from geocoding
    5. Assign dynamic issue_type (free-form string stored in category)
    6. Match predefined IssueType record if possible (for FK)
    7. Assign department (from IssueType FK → AI dept → inferred)

    Never fails due to AI/geo errors.
    """
    # ── Step 1: Validate pre-selected issue_type_id ────────────────────────
    issue_type_obj: Optional[IssueType] = None
    if issue_type_id:
        issue_type_obj = await _resolve_issue_type(issue_type_id, db)

    # ── Step 2: Upload images ──────────────────────────────────────────────
    uploaded_urls: list[str] = []
    for img in images:
        if img.filename:
            url = await upload_image(img, folder="issues")
            uploaded_urls.append(url)

    image_url = uploaded_urls[0] if uploaded_urls else None

    # ── Step 3: Reverse geocode ────────────────────────────────────────────
    geo_result = {"address": "Unknown", "city": "", "state": "", "area_type": "unknown"}
    resolved_address = address or ""
    resolved_area_type = context or "unknown"

    if latitude is not None and longitude is not None:
        geo_result = await reverse_geocode(latitude, longitude)
        # Only overwrite if not already provided by user
        if not address or address.strip() == "":
            resolved_address = geo_result["address"]
        if not context or context.strip() == "":
            resolved_area_type = geo_result["area_type"]

    # ── Step 4: AI analysis ────────────────────────────────────────────────
    # Run AI even if user pre-selected issue_type (for severity/priority/reasoning)
    ai_result = await analyze_issue(
        title=title,
        description=description,
        image_url=image_url,
        address=resolved_address if resolved_address != "Unknown" else "",
        area_type=resolved_area_type,
    )

    ai_issue_type_name: str = ai_result.get("issue_type", "")
    ai_department_name: str = ai_result.get("department", "")

    # ── Step 5 & 6: Issue type assignment ─────────────────────────────────
    # If user pre-selected → keep their choice; AI only enriches severity/priority
    if not issue_type_obj:
        # Try to match AI-generated type to a predefined IssueType record
        if ai_issue_type_name:
            issue_type_obj = await _get_issue_type_by_name(ai_issue_type_name, db)
            # If no exact match, dynamic type — issue_type_id stays None,
            # but we store the string in category

    # Determine final category string (issue type label shown in UI)
    final_category: str = (
        issue_type_obj.name
        if issue_type_obj
        else (ai_issue_type_name or category or "Civic Issue")
    )

    # ── Step 7: Department assignment ─────────────────────────────────────
    dept_id: Optional[str] = None

    if issue_type_obj and issue_type_obj.department_id:
        # Best: from predefined IssueType FK
        dept_id = issue_type_obj.department_id
    elif ai_department_name:
        # Second: from AI result (already validated in ai_service)
        dept_obj = await _get_department_by_name(ai_department_name, db)
        if dept_obj:
            dept_id = dept_obj.id
    
    if not dept_id:
        # Third: infer from category text
        inferred_dept_name = infer_department(
            f"{final_category} {title} {description}", resolved_area_type
        )
        dept_obj = await _get_department_by_name(inferred_dept_name, db)
        if dept_obj:
            dept_id = dept_obj.id

    # ── Create Issue record ────────────────────────────────────────────────
    issue = Issue(
        title=title,
        description=description,
        latitude=latitude,
        longitude=longitude,
        address=resolved_address if resolved_address else address,
        context=resolved_area_type if resolved_area_type != "unknown" else (context or None),
        issue_type_id=issue_type_obj.id if issue_type_obj else None,
        department_id=dept_id,
        category=final_category,
        reporter_id=current_user.id,
        status="not_assigned",
        # Apply AI severity/priority
        ai_confidence=ai_result.get("confidence"),
        ai_reasoning=ai_result.get("reasoning"),
        severity=ai_result.get("predicted_severity", "medium"),
        priority=ai_result.get("predicted_priority", 3),
    )
    db.add(issue)
    await db.flush()

    # ── Link uploaded media ────────────────────────────────────────────────
    for url in uploaded_urls:
        db.add(IssueMedia(issue_id=issue.id, url=url, upload_phase="before"))

    # ── Save AI prediction record ──────────────────────────────────────────
    prediction = AIPrediction(
        issue_id=issue.id,
        predicted_category=final_category,          # dynamic or predefined string
        predicted_department=ai_department_name,
        predicted_severity=ai_result.get("predicted_severity"),
        predicted_priority=ai_result.get("predicted_priority"),
        confidence=ai_result.get("confidence"),
        reasoning=ai_result.get("reasoning"),
        model_version=ai_result.get("model_version"),
        raw_response=ai_result.get("raw_response"),
    )
    db.add(prediction)

    # ── Status history ─────────────────────────────────────────────────────
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
    search: Optional[str] = Query(None),
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
    if search:
        query = query.where(Issue.title.ilike(f"%{search}%"))

    query = query.order_by(
        case((Issue.status == "closed", 1), else_=0).asc(),
        Issue.updated_at.desc()
    ).offset((page - 1) * page_size).limit(page_size)

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
    result = await db.execute(
        select(Issue).where((Issue.id == issue_id) & (Issue.is_deleted == False))
    )
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the reporter can verify")
    if issue.status == "closed":
        raise HTTPException(status_code=400, detail="Issue is already closed")
    if issue.status != "resolved":
        raise HTTPException(status_code=400, detail="Issue must be in 'resolved' status to verify")

    from app.models.verification_vote import VerificationVote
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
            notes=f"Citizen rejected resolution. Reason: {data.rejection_reason or 'Not satisfied'}. Priority increased."
        ))

    await db.flush()

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
    """Upload additional media to an existing issue."""
    result = await db.execute(
        select(Issue).where((Issue.id == issue_id) & (Issue.is_deleted == False))
    )
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

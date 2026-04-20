from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class IssueCreate(BaseModel):
    title: str
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    context: Optional[str] = None
    issue_type_id: Optional[str] = None   # New primary field


class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    issue_type_id: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[int] = None


class StatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


class AdminOverride(BaseModel):
    issue_type_id: Optional[str] = None   # New primary field; auto-assigns department
    department_id: Optional[str] = None
    officer_label_id: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[int] = None
    status: Optional[str] = None
    resolution_notes: Optional[str] = None
    notes: Optional[str] = None
    # Legacy — still accepted but ignored if issue_type_id provided
    category: Optional[str] = None


class AiFeedbackRequest(BaseModel):
    is_correct: bool  # True = AI was correct, False = AI was wrong


class AssignOfficerRequest(BaseModel):
    officer_name: Optional[str] = None
    officer_id: Optional[str] = None
    notes: Optional[str] = None


class ResolveIssueRequest(BaseModel):
    resolution_notes: str
    notes: Optional[str] = None


class VerificationVoteCreate(BaseModel):
    approved: bool
    rating: Optional[int] = None
    feedback: Optional[str] = None
    rejection_reason: Optional[str] = None


class MediaOut(BaseModel):
    id: str
    url: str
    media_type: str
    upload_phase: str
    created_at: datetime

    class Config:
        from_attributes = True


class AIPredictionOut(BaseModel):
    id: str
    predicted_category: Optional[str] = None
    predicted_department: Optional[str] = None
    predicted_severity: Optional[str] = None
    predicted_priority: Optional[int] = None
    confidence: Optional[float] = None
    reasoning: Optional[str] = None
    model_version: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VerificationVoteOut(BaseModel):
    id: str
    voter_id: str
    approved: bool
    rating: Optional[int] = None
    feedback: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class StatusHistoryOut(BaseModel):
    id: str
    from_status: Optional[str] = None
    to_status: str
    changed_by: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AssignmentHistoryOut(BaseModel):
    id: str
    assigned_by: Optional[str] = None
    department_id: Optional[str] = None
    officer_label_id: Optional[str] = None
    officer_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReporterOut(BaseModel):
    id: str
    full_name: str
    email: str

    class Config:
        from_attributes = True


class DepartmentOut(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class IssueTypeOut(BaseModel):
    id: str
    name: str
    department_id: Optional[str] = None
    expected_resolution_hours: Optional[float] = None

    class Config:
        from_attributes = True


class OfficerLabelOut(BaseModel):
    id: str
    name: str
    department_id: Optional[str] = None

    class Config:
        from_attributes = True


class OfficerBriefOut(BaseModel):
    id: str
    name: str
    email: str
    designation: Optional[str] = None
    department_id: Optional[str] = None

    class Config:
        from_attributes = True


class IssueOut(BaseModel):
    id: str
    title: str
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    context: Optional[str] = None
    # New structured classification
    issue_type_id: Optional[str] = None
    # Legacy field for backward compatibility
    category: Optional[str] = None
    severity: str
    priority: int
    status: str
    ai_confidence: Optional[float] = None
    ai_reasoning: Optional[str] = None
    is_ai_correct: Optional[bool] = None  # Admin feedback on AI accuracy
    resolution_notes: Optional[str] = None
    reopen_count: int
    citizen_rating: Optional[int] = None
    citizen_feedback: Optional[str] = None
    reporter_id: str
    department_id: Optional[str] = None
    officer_label_id: Optional[str] = None
    officer_name: Optional[str] = None
    officer_id: Optional[str] = None
    assigned_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IssueListOut(IssueOut):
    reporter: Optional[ReporterOut] = None
    department: Optional[DepartmentOut] = None
    issue_type: Optional[IssueTypeOut] = None
    media_count: Optional[int] = 0


class IssueDetailOut(IssueOut):
    reporter: Optional[ReporterOut] = None
    department: Optional[DepartmentOut] = None
    issue_type: Optional[IssueTypeOut] = None
    officer_label: Optional[OfficerLabelOut] = None
    officer: Optional[OfficerBriefOut] = None
    media: List[MediaOut] = []
    ai_predictions: List[AIPredictionOut] = []
    verification_votes: List[VerificationVoteOut] = []
    status_history: List[StatusHistoryOut] = []
    assignment_history: List[AssignmentHistoryOut] = []

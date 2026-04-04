import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float, Integer, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Issue(Base):
    __tablename__ = "issues"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)

    # Location
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(Text, nullable=True)
    context = Column(String(20), nullable=True)

    # Classification (new structured system)
    issue_type_id = Column(String(36), ForeignKey("issue_types.id"), nullable=True)
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=True)

    # Legacy fields — kept for DB compatibility; category is auto-populated from issue_type.name
    category = Column(String(100), nullable=True)
    subcategory = Column(String(100), nullable=True)

    # Officer assignment
    officer_label_id = Column(String(36), ForeignKey("officer_labels.id"), nullable=True)
    officer_name = Column(String(255), nullable=True)

    # Severity & priority
    severity = Column(String(20), default="medium")
    priority = Column(Integer, default=3)

    # Status
    status = Column(String(30), default="not_assigned")

    # AI
    ai_confidence = Column(Float, nullable=True)
    ai_reasoning = Column(Text, nullable=True)

    # Resolution
    resolution_notes = Column(Text, nullable=True)
    reopen_count = Column(Integer, default=0)

    # Verification
    citizen_rating = Column(Integer, nullable=True)
    citizen_feedback = Column(Text, nullable=True)

    # Reporter
    reporter_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    # Soft Delete
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    reporter = relationship("User", back_populates="issues", foreign_keys=[reporter_id])
    department = relationship("Department", back_populates="issues")
    issue_type = relationship("IssueType", back_populates="issues")
    officer_label = relationship("OfficerLabel")
    media = relationship("IssueMedia", back_populates="issue", cascade="all, delete-orphan")
    ai_predictions = relationship("AIPrediction", back_populates="issue", cascade="all, delete-orphan")
    verification_votes = relationship("VerificationVote", back_populates="issue", cascade="all, delete-orphan")
    status_history = relationship("StatusHistory", back_populates="issue", cascade="all, delete-orphan", order_by="StatusHistory.created_at")
    assignment_history = relationship("AssignmentHistory", back_populates="issue", cascade="all, delete-orphan", order_by="AssignmentHistory.created_at")

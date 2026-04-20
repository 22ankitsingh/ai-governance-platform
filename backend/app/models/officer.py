import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Officer(Base):
    __tablename__ = "officers"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    mobile_number = Column(String(20), nullable=True)

    # Department & designation
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=True)
    designation = Column(String(255), nullable=True)

    # Availability
    is_available = Column(Boolean, default=True)
    is_on_leave = Column(Boolean, default=False)

    # Performance
    avg_rating = Column(Float, default=0.0)
    total_ratings = Column(Integer, default=0)
    negative_tickets = Column(Integer, default=0)

    # Suspension and Deletion
    is_suspended = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    department = relationship("Department", back_populates="officers")
    assigned_issues = relationship("Issue", back_populates="officer", foreign_keys="Issue.officer_id")

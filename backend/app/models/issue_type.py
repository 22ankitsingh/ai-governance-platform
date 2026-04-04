import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class IssueType(Base):
    __tablename__ = "issue_types"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    category = Column(String(100), nullable=False)
    subcategory = Column(String(100), nullable=False)
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

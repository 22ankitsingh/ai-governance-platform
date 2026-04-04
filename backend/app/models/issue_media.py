import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class IssueMedia(Base):
    __tablename__ = "issue_media"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    issue_id = Column(String(36), ForeignKey("issues.id", ondelete="CASCADE"), nullable=False)
    url = Column(String(1000), nullable=False)
    media_type = Column(String(20), default="image")
    upload_phase = Column(String(20), default="before")
    created_at = Column(DateTime, default=datetime.utcnow)

    issue = relationship("Issue", back_populates="media")

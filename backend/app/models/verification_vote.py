import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class VerificationVote(Base):
    __tablename__ = "verification_votes"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    issue_id = Column(String(36), ForeignKey("issues.id", ondelete="CASCADE"), nullable=False)
    voter_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    approved = Column(Boolean, nullable=False)
    rating = Column(Integer, nullable=True)
    feedback = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    issue = relationship("Issue", back_populates="verification_votes")
    voter = relationship("User", back_populates="verification_votes")

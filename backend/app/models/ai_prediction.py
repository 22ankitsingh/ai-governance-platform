import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    issue_id = Column(String(36), ForeignKey("issues.id", ondelete="CASCADE"), nullable=False)

    predicted_category = Column(String(100), nullable=True)
    predicted_subcategory = Column(String(100), nullable=True)
    predicted_department = Column(String(255), nullable=True)
    predicted_severity = Column(String(20), nullable=True)
    predicted_priority = Column(Integer, nullable=True)
    confidence = Column(Float, nullable=True)
    reasoning = Column(Text, nullable=True)
    model_version = Column(String(50), default="demo-v1")
    raw_response = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    issue = relationship("Issue", back_populates="ai_predictions")

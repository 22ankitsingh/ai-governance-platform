from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class OfficerCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    mobile_number: Optional[str] = None
    department_id: Optional[str] = None
    designation: Optional[str] = None


class OfficerLogin(BaseModel):
    email: EmailStr
    password: str


class OfficerOut(BaseModel):
    id: str
    name: str
    email: str
    mobile_number: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    designation: Optional[str] = None
    is_available: bool
    is_on_leave: bool
    is_suspended: bool
    is_deleted: bool
    avg_rating: float
    total_ratings: int
    negative_tickets: int
    role: str = "officer"
    created_at: datetime

    class Config:
        from_attributes = True


class OfficerTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: OfficerOut


class OfficerProfileUpdate(BaseModel):
    name: Optional[str] = None
    mobile_number: Optional[str] = None
    designation: Optional[str] = None


class OfficerLeaveToggle(BaseModel):
    is_on_leave: bool


class OfficerResolveRequest(BaseModel):
    resolution_notes: str


class OfficerListOut(BaseModel):
    id: str
    name: str
    email: str
    mobile_number: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    designation: Optional[str] = None
    is_available: bool
    is_on_leave: bool
    is_suspended: bool
    is_deleted: bool
    avg_rating: float
    total_ratings: int
    negative_tickets: int
    created_at: datetime

    class Config:
        from_attributes = True

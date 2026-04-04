from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserUpdateProfile, UserUpdatePassword
from app.middleware.auth import get_current_user, verify_password, hash_password

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    print(f"DEBUG: GET /me reached for user {current_user.email}")
    return UserOut.model_validate(current_user)


@router.put("/me", response_model=UserOut)
async def update_profile(
    data: UserUpdateProfile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    print(f"DEBUG: PUT /me reached for user {current_user.email} with data {data}")
    current_user.full_name = data.full_name
    current_user.phone = data.phone
    current_user.updated_at = datetime.utcnow()
    await db.flush()
    return UserOut.model_validate(current_user)


@router.put("/me/password", status_code=200)
async def update_password(
    data: UserUpdatePassword,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    current_user.hashed_password = hash_password(data.new_password)
    current_user.updated_at = datetime.utcnow()
    await db.flush()
    return {"detail": "Password updated successfully"}


@router.delete("/me", status_code=204)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    current_user.is_deleted = True
    current_user.deleted_at = datetime.utcnow()
    # It says 'Do NOT physically delete' so we just update flags
    await db.flush()
    return None

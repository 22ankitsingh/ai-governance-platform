from datetime import datetime, timedelta
from typing import Optional, Union

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.officer import Officer

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticate and return a User (citizen or admin). Officers are rejected."""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        role: str = payload.get("role", "")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Officer tokens are handled by get_current_officer instead
    if role == "officer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer tokens cannot access citizen/admin endpoints. Use /api/officer/* endpoints.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active or user.is_deleted:
        raise credentials_exception
    return user


async def get_current_officer(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Officer:
    """Authenticate and return an Officer. Non-officer tokens are rejected."""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        officer_id: str = payload.get("sub")
        role: str = payload.get("role", "")
        if officer_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    if role != "officer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer access required",
        )

    result = await db.execute(select(Officer).where(Officer.id == officer_id))
    officer = result.scalar_one_or_none()
    if officer is None:
        raise credentials_exception
    return officer


async def get_current_user_or_officer(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Union[User, Officer]:
    """Authenticate and return either a User or an Officer based on the JWT role claim.
    Used for endpoints that both roles can access (e.g. issue detail view)."""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        entity_id: str = payload.get("sub")
        role: str = payload.get("role", "")
        if entity_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    if role == "officer":
        result = await db.execute(select(Officer).where(Officer.id == entity_id))
        officer = result.scalar_one_or_none()
        if officer is None:
            raise credentials_exception
        return officer
    else:
        result = await db.execute(select(User).where(User.id == entity_id))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active or user.is_deleted:
            raise credentials_exception
        return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def require_citizen(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "citizen":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizen access required",
        )
    return current_user


async def require_officer(current_officer: Officer = Depends(get_current_officer)) -> Officer:
    return current_officer

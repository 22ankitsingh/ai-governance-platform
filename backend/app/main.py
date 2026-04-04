import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db, async_session_factory


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()

    # Import models to register them
    from app.models import (
        User, Department, IssueType, OfficerLabel, Issue,
        IssueMedia, AIPrediction, VerificationVote, Notification,
        AssignmentHistory, StatusHistory,
    )

    # Seed database
    from app.seed import seed_database
    async with async_session_factory() as session:
        await seed_database(session)

    yield
    # Shutdown — nothing to clean up


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Governance Platform for civic issue reporting and management",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for local uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Register routers
from app.routers.auth import router as auth_router
from app.routers.issues import router as issues_router
from app.routers.admin import router as admin_router
from app.routers.analytics import router as analytics_router
from app.routers.notifications import router as notifications_router
from app.routers.reference import router as reference_router

app.include_router(auth_router)
app.include_router(issues_router)
app.include_router(admin_router)
app.include_router(analytics_router)
app.include_router(notifications_router)
app.include_router(reference_router)


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "ai_mode": "gemini" if settings.gemini_configured else "demo",
        "storage_mode": "cloudinary" if settings.cloudinary_configured else "local",
        "email_mode": "sendgrid" if settings.sendgrid_configured else "in-app",
    }

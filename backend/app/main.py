import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db, async_session_factory

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    db_url_display = settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else settings.DATABASE_URL
    logger.info(f"Connected to PostgreSQL (NeonDB): {db_url_display}")

    await init_db()  # creates tables, logs 'Database schema initialized'

    # Import models to register them with SQLAlchemy metadata
    from app.models import (
        User, Department, IssueType, OfficerLabel, Officer, Issue,
        IssueMedia, AIPrediction, VerificationVote, Notification,
        AssignmentHistory, StatusHistory,
    )

    # Seed database
    from app.seed import seed_database
    async with async_session_factory() as session:
        await seed_database(session)
    logger.info("Seeding completed")

    yield
    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("Application shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    description="PrajaGov: AI-Powered Governance Platform for civic issue reporting and management",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL] if settings.ENVIRONMENT == "production" else [settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    if settings.ENVIRONMENT == "production":
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal server error occurred."}
        )
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )

# Static files for local uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Register routers
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.issues import router as issues_router
from app.routers.admin import router as admin_router
from app.routers.analytics import router as analytics_router
from app.routers.notifications import router as notifications_router
from app.routers.reference import router as reference_router
from app.routers.officer import router as officer_router

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(issues_router)
app.include_router(admin_router)
app.include_router(analytics_router)
app.include_router(notifications_router)
app.include_router(reference_router)
app.include_router(officer_router)


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "ai_mode": "gemini" if settings.gemini_configured else "demo",
        "storage_mode": "cloudinary" if settings.cloudinary_configured else "local",
        "email_mode": "sendgrid" if settings.sendgrid_configured else "in-app",
    }

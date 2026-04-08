from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database — uses SQLite by default for easy local dev, switch to PostgreSQL for production
    DATABASE_URL: str = "sqlite+aiosqlite:///./governance.db"

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production-abc123"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # SendGrid (legacy — kept for backward compat)
    SENDGRID_API_KEY: Optional[str] = None
    SENDGRID_FROM_EMAIL: str = "noreply@governance.local"

    # SMTP — used for resolution email notifications
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None  # Falls back to SMTP_USER if not set

    # Google Gemini
    GEMINI_API_KEY: Optional[str] = None

    # App
    APP_NAME: str = "AI-Powered Governance Platform"
    FRONTEND_URL: str = "http://localhost:5173"
    UPLOAD_DIR: str = "uploads"
    VERIFICATION_APPROVAL_THRESHOLD: int = 3

    @property
    def cloudinary_configured(self) -> bool:
        return bool(self.CLOUDINARY_CLOUD_NAME and self.CLOUDINARY_API_KEY and self.CLOUDINARY_API_SECRET)

    @property
    def sendgrid_configured(self) -> bool:
        return bool(self.SENDGRID_API_KEY)

    @property
    def smtp_configured(self) -> bool:
        """True only when all mandatory SMTP fields are present."""
        return bool(self.SMTP_HOST and self.SMTP_USER and self.SMTP_PASSWORD)

    @property
    def gemini_configured(self) -> bool:
        return bool(self.GEMINI_API_KEY)

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

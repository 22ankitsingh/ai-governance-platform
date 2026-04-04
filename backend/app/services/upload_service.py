"""
Upload Service — supports Cloudinary when configured, falls back to local file storage.
"""
import os
import uuid
import aiofiles
from typing import Optional
from fastapi import UploadFile

from app.config import settings


async def upload_image(file: UploadFile, folder: str = "issues") -> str:
    """Upload image — uses Cloudinary if configured, else local storage."""
    if settings.cloudinary_configured:
        return await _upload_cloudinary(file, folder)
    return await _upload_local(file, folder)


async def _upload_cloudinary(file: UploadFile, folder: str) -> str:
    """Upload to Cloudinary."""
    try:
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
        )

        contents = await file.read()
        result = cloudinary.uploader.upload(
            contents,
            folder=f"governance/{folder}",
            resource_type="image",
        )
        return result["secure_url"]
    except Exception:
        # Fall back to local on error
        await file.seek(0)
        return await _upload_local(file, folder)


async def _upload_local(file: UploadFile, folder: str) -> str:
    """Save to local uploads directory."""
    upload_dir = os.path.join(settings.UPLOAD_DIR, folder)
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(upload_dir, filename)

    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)

    return f"/uploads/{folder}/{filename}"

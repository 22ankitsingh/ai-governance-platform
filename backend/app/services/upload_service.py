"""
Upload Service — supports Cloudinary when configured, falls back to local file storage.

Extras:
  - read_image_bytes(url): read an image (local or remote) as raw bytes for Gemini multimodal
"""
import os
import uuid
import logging
import aiofiles
from typing import Optional
from fastapi import UploadFile

from app.config import settings

logger = logging.getLogger(__name__)


async def upload_image(file: UploadFile, folder: str = "issues") -> str:
    """Upload image — uses Cloudinary if configured, else local storage."""
    if settings.cloudinary_configured:
        return await _upload_cloudinary(file, folder)
    return await _upload_local(file, folder)


async def _upload_cloudinary(file: UploadFile, folder: str) -> str:
    """Upload to Cloudinary and return secure_url."""
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
        url = result["secure_url"]
        logger.info(f"Cloudinary upload success: {url}")
        return url
    except Exception as e:
        logger.warning(f"Cloudinary upload failed: {e}. Falling back to local.")
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


async def read_image_bytes(url: str) -> Optional[bytes]:
    """
    Read image as raw bytes — works for both local paths and remote HTTPS URLs.
    Used to provide inline image data to Gemini multimodal.

    Returns None on any failure (Gemini will proceed text-only).
    """
    if not url:
        return None

    try:
        # Local file: /uploads/issues/xxx.jpg
        if url.startswith("/uploads/"):
            filepath = url.lstrip("/")  # strip leading slash → relative path
            # Try from backend working directory
            if not os.path.isabs(filepath):
                filepath = os.path.join(os.getcwd(), filepath)
            if os.path.exists(filepath):
                async with aiofiles.open(filepath, "rb") as f:
                    data = await f.read()
                logger.debug(f"Read local image: {filepath} ({len(data)} bytes)")
                return data
            else:
                logger.warning(f"Local image not found: {filepath}")
                return None

        # Remote URL: download via httpx
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            logger.debug(f"Downloaded remote image: {url} ({len(resp.content)} bytes)")
            return resp.content

    except Exception as e:
        logger.warning(f"read_image_bytes failed for {url}: {e}")
        return None

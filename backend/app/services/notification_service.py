"""
Notification Service — creates in-app notifications and optionally sends email via SendGrid.
"""
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    title: str,
    message: str,
    notification_type: str = "info",
    reference_id: Optional[UUID] = None,
    send_email: bool = True,
) -> Notification:
    """Create in-app notification and optionally send email."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        reference_id=reference_id,
    )
    db.add(notif)
    await db.flush()

    # Send email if SendGrid is configured
    if send_email and settings.sendgrid_configured:
        await _send_email_notification(user_id, title, message, db)

    return notif


async def _send_email_notification(user_id: UUID, subject: str, body: str, db: AsyncSession):
    """Send email via SendGrid (best-effort, never raises)."""
    try:
        from sqlalchemy import select
        from app.models.user import User
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return

        message = Mail(
            from_email=settings.SENDGRID_FROM_EMAIL,
            to_emails=user.email,
            subject=f"[PrajaGov] {subject}",
            html_content=f"<p>{body}</p>",
        )
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        sg.send(message)
    except Exception:
        pass  # Email failure should never break app flow

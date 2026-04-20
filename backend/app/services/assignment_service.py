"""
Assignment Service — handles automatic officer assignment, release, negative tickets, and ratings.
"""
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.officer import Officer
from app.models.issue import Issue
from app.models.issue_type import IssueType
from app.models.status_history import StatusHistory
from app.models.assignment_history import AssignmentHistory
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)


async def auto_assign_officer(issue: Issue, db: AsyncSession) -> Optional[Officer]:
    """
    Attempt to auto-assign an available officer from the same department.

    Selection priority:
    1. Fewest negative tickets
    2. Highest average rating
    3. First available

    Returns the assigned Officer or None if no one is available.
    """
    if not issue.department_id:
        logger.info(f"Issue {issue.id}: No department assigned, skipping auto-assignment")
        return None

    query = (
        select(Officer)
        .where(
            Officer.department_id == issue.department_id,
            Officer.is_available == True,
            Officer.is_on_leave == False,
            Officer.is_suspended == False,
            Officer.is_deleted == False,
        )
        .order_by(
            Officer.negative_tickets.asc(),
            Officer.avg_rating.desc(),
            Officer.created_at.asc(),
        )
        .limit(1)
    )

    result = await db.execute(query)
    officer = result.scalar_one_or_none()

    if not officer:
        logger.info(f"Issue {issue.id}: No available officer in department {issue.department_id}")
        return None

    # Assign the officer
    issue.officer_id = officer.id
    issue.officer_name = officer.name
    issue.assigned_at = datetime.utcnow()
    issue.status = "in_progress"
    issue.updated_at = datetime.utcnow()

    # Mark officer unavailable
    officer.is_available = False

    # Status history
    db.add(StatusHistory(
        issue_id=issue.id,
        from_status="not_assigned",
        to_status="in_progress",
        changed_by=None,  # system-assigned
        notes=f"Auto-assigned to officer: {officer.name} ({officer.designation or 'N/A'})",
    ))

    # Assignment history
    db.add(AssignmentHistory(
        issue_id=issue.id,
        assigned_by=None,  # system
        department_id=issue.department_id,
        officer_name=officer.name,
        notes=f"Auto-assigned by system to {officer.name}",
    ))

    # Notify reporter
    await create_notification(
        db, issue.reporter_id,
        title="Officer Assigned to Your Issue",
        message=f'Officer "{officer.name}" has been automatically assigned to your issue "{issue.title}". Status is now In Progress.',
        notification_type="status_change",
        reference_id=issue.id,
    )

    logger.info(f"Issue {issue.id}: Auto-assigned to officer {officer.name} ({officer.id})")
    return officer


async def release_officer(officer: Officer, db: AsyncSession) -> None:
    """Mark an officer as available after issue resolution/closure."""
    officer.is_available = True
    logger.info(f"Officer {officer.id} ({officer.name}): Released, now available")


def increment_negative_ticket(officer: Officer) -> None:
    """Increment negative tickets and automatically suspend if >= 5."""
    officer.negative_tickets += 1
    if officer.negative_tickets >= 5:
        officer.is_suspended = True
        logger.warning(f"Officer {officer.id} automatically suspended due to {officer.negative_tickets} negative tickets.")


async def check_negative_ticket(issue: Issue, officer: Officer, db: AsyncSession) -> bool:
    """
    Check if the officer took longer than expected to resolve the issue.
    If so, increment negative_tickets.

    Returns True if a negative ticket was issued.
    """
    if not issue.assigned_at or not issue.resolved_at:
        return False

    # Get expected resolution hours from issue type
    expected_hours = None
    if issue.issue_type_id:
        result = await db.execute(
            select(IssueType).where(IssueType.id == issue.issue_type_id)
        )
        issue_type = result.scalar_one_or_none()
        if issue_type and issue_type.expected_resolution_hours:
            expected_hours = issue_type.expected_resolution_hours

    if expected_hours is None:
        # Default: 24 hours if not specified
        expected_hours = 24.0

    actual_hours = (issue.resolved_at - issue.assigned_at).total_seconds() / 3600.0

    if actual_hours > expected_hours:
        increment_negative_ticket(officer)
        logger.info(
            f"Officer {officer.id} ({officer.name}): Negative ticket issued. "
            f"Expected: {expected_hours}h, Actual: {actual_hours:.1f}h. Total: {officer.negative_tickets}"
        )
        return True

    return False


async def update_officer_rating(officer: Officer, rating: int, db: AsyncSession) -> None:
    """
    Update officer's average rating with a new citizen rating.

    Formula: avg_rating = (old_avg * total_ratings + new_rating) / (total_ratings + 1)
    """
    if rating is None or rating < 1 or rating > 5:
        return

    total_sum = officer.avg_rating * officer.total_ratings
    officer.total_ratings += 1
    officer.avg_rating = round((total_sum + rating) / officer.total_ratings, 2)

    logger.info(
        f"Officer {officer.id} ({officer.name}): Rating updated to {officer.avg_rating} "
        f"({officer.total_ratings} total ratings)"
    )

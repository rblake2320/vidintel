"""Session management endpoints: list and delete user sessions."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Job, Session
from app.models.schemas import SessionResponse
from app.routers.auth import get_current_user

router = APIRouter(tags=["sessions"])


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """List all sessions for the authenticated user, newest first."""
    result = await db.execute(
        select(Session)
        .where(Session.user_id == uuid.UUID(user_id))
        .order_by(Session.created_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()

    # Fetch the most recent job status per session
    session_ids = [s.id for s in sessions]
    job_map: dict[uuid.UUID, Job] = {}
    if session_ids:
        job_result = await db.execute(
            select(Job)
            .where(Job.session_id.in_(session_ids))
            .order_by(Job.created_at.desc())
        )
        for job in job_result.scalars().all():
            if job.session_id not in job_map:
                job_map[job.session_id] = job

    rows = []
    for s in sessions:
        job = job_map.get(s.id)
        row = SessionResponse.model_validate(s)
        if job:
            row.job_status = job.status
            row.job_error = job.error_message
        rows.append(row)
    return rows


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Delete a session and its associated jobs."""
    # Verify ownership
    result = await db.execute(
        select(Session).where(
            Session.id == session_id, Session.user_id == uuid.UUID(user_id)
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Delete jobs first (FK constraint)
    await db.execute(delete(Job).where(Job.session_id == session_id))
    await db.execute(delete(Session).where(Session.id == session_id))

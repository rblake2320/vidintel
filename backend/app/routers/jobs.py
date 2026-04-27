"""Job processing endpoints: submit, status, bulk, downloads, usage."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.db.models import Job, Session
from app.models.schemas import (
    BulkJobResponse,
    BulkProcessRequest,
    JobResponse,
    JobStatusResponse,
    UsageResponse,
    ProcessRequest,
)
from app.routers.auth import get_current_user
from app.services import exporter
from app.tasks.celery_tasks import process_video

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(tags=["jobs"])


def _extract_llm_headers(request: Request) -> tuple[str, str]:
    """Return (user_api_key, user_llm_provider) from request headers."""
    return (
        request.headers.get("X-LLM-Key", ""),
        request.headers.get("X-LLM-Provider", ""),
    )


@router.post("/process", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(settings.RATE_LIMIT_FREE)
async def submit_job(
    request: Request,
    body: ProcessRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Submit a new video/transcript processing job."""
    uid = uuid.UUID(user_id)
    user_api_key, user_llm_provider = _extract_llm_headers(request)

    session = Session(
        user_id=uid,
        source_url=body.source if body.source_type == "youtube" else None,
        source_type=body.source_type.value,
        output_format=body.output_format.value,
        raw_transcript=body.source if body.source_type == "paste" else None,
    )
    db.add(session)
    await db.flush()

    job = Job(session_id=session.id, user_id=uid, status="pending")
    db.add(job)
    await db.flush()
    await db.commit()

    process_video.delay(
        job_id=str(job.id),
        source=body.source,
        source_type=body.source_type.value,
        output_format=body.output_format.value,
        user_id=user_id,
        user_api_key=user_api_key,
        user_llm_provider=user_llm_provider,
    )

    return JobResponse(job_id=job.id, session_id=session.id, status=job.status)


@router.post("/bulk", response_model=BulkJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_bulk(
    request: Request,
    body: BulkProcessRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Submit up to 50 jobs in one request."""
    uid = uuid.UUID(user_id)
    user_api_key, user_llm_provider = _extract_llm_headers(request)

    created: list[tuple[Job, Session]] = []
    for item in body.items:
        sess = Session(
            user_id=uid,
            source_url=item.source if item.source_type == "youtube" else None,
            source_type=item.source_type.value,
            output_format=item.output_format.value,
            raw_transcript=item.source if item.source_type == "paste" else None,
        )
        db.add(sess)
        await db.flush()

        job = Job(session_id=sess.id, user_id=uid, status="pending")
        db.add(job)
        await db.flush()
        created.append((job, sess))

    await db.commit()

    for job, sess in created:
        process_video.delay(
            job_id=str(job.id),
            source=sess.raw_transcript or (sess.source_url or ""),
            source_type=sess.source_type,
            output_format=sess.output_format,
            user_id=user_id,
            user_api_key=user_api_key,
            user_llm_provider=user_llm_provider,
        )

    return BulkJobResponse(
        jobs=[JobResponse(job_id=j.id, session_id=s.id, status=j.status) for j, s in created],
        total=len(created),
    )


@router.get("/usage", response_model=UsageResponse)
async def get_usage(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Return how many jobs the user has run in the last hour."""
    uid = uuid.UUID(user_id)
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    result = await db.execute(
        select(func.count(Job.id)).where(Job.user_id == uid, Job.created_at >= since)
    )
    count = result.scalar_one() or 0
    return UsageResponse(jobs_this_hour=count, limit_per_hour=10)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Get the current status of a processing job."""
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == uuid.UUID(user_id))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    output_content = None
    if job.status == "done":
        session_result = await db.execute(select(Session).where(Session.id == job.session_id))
        sess = session_result.scalar_one_or_none()
        if sess:
            output_content = sess.output_content

    return JobStatusResponse(
        job_id=job.id,
        session_id=job.session_id,
        status=job.status,
        error_message=job.error_message,
        output_content=output_content,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


async def _get_job_output(job_id: uuid.UUID, db: AsyncSession, user_id: str) -> str:
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == uuid.UUID(user_id))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status != "done":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job not complete (status: {job.status})",
        )
    session_result = await db.execute(select(Session).where(Session.id == job.session_id))
    sess = session_result.scalar_one_or_none()
    if not sess or not sess.output_content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Output not found")
    return sess.output_content


@router.get("/jobs/{job_id}/download/md")
async def download_markdown(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    content = await _get_job_output(job_id, db, user_id)
    md_bytes = exporter.to_markdown(content)
    filename = f"vidintel-{str(job_id)[:8]}.md"
    return Response(
        content=md_bytes,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/jobs/{job_id}/download/pdf")
async def download_pdf(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    content = await _get_job_output(job_id, db, user_id)
    pdf_bytes = exporter.to_pdf(content)
    filename = f"vidintel-{str(job_id)[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

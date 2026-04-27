"""Celery application and background tasks."""

import logging
import uuid
from datetime import datetime, timezone

from celery import Celery
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import Session as SASession, sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)

# Celery uses sync Redis broker (not asyncpg)
celery_app = Celery(
    "vidintel",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# Sync database URL for Celery worker (replace asyncpg with psycopg2)
SYNC_DATABASE_URL = settings.DATABASE_URL.replace(
    "postgresql+asyncpg://", "postgresql://"
)

# Create engine and session factory once at module level (not per task)
_sync_engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True)
_SyncSession = sessionmaker(bind=_sync_engine)


def _get_sync_session() -> SASession:
    """Return a synchronous SQLAlchemy session for Celery tasks."""
    return _SyncSession()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def process_video(
    self,
    job_id: str,
    source: str,
    source_type: str,
    output_format: str,
    user_id: str,
    user_api_key: str = "",
    user_llm_provider: str = "",
):
    """
    Main processing task. Extracts transcript, runs LLM, saves output.

    Steps:
    1. Update job status to 'processing'
    2. Extract transcript
    3. Process with LLM
    4. Save output to session
    5. Update job status to 'done'
    On failure: update status to 'failed' with error message
    """
    # Import ORM models here to avoid circular imports at module level
    from app.db.models import Job, Session

    db = _get_sync_session()
    try:
        job_uuid = uuid.UUID(job_id)

        # 1. Update status to processing
        db.execute(
            update(Job)
            .where(Job.id == job_uuid)
            .values(status="processing", updated_at=datetime.now(timezone.utc))
        )
        db.commit()

        # Get the session record
        job_row = db.execute(select(Job).where(Job.id == job_uuid)).scalar_one()
        session_row = db.execute(
            select(Session).where(Session.id == job_row.session_id)
        ).scalar_one()

        # 2. Extract transcript
        from app.services.extractor import extract_transcript

        transcript = extract_transcript(
            source=source,
            source_type=source_type,
            openai_api_key=settings.OPENAI_API_KEY,
        )

        # Save raw transcript
        db.execute(
            update(Session)
            .where(Session.id == session_row.id)
            .values(
                raw_transcript=transcript,
                updated_at=datetime.now(timezone.utc),
            )
        )
        db.commit()

        # 3. Process with LLM — user-provided key takes precedence
        from app.services.processor import process_transcript

        if user_llm_provider == "anthropic" and user_api_key:
            anthropic_key, openai_key, nvidia_key = user_api_key, "", ""
        elif user_llm_provider == "openai" and user_api_key:
            anthropic_key, openai_key, nvidia_key = "", user_api_key, ""
        elif user_llm_provider == "nvidia" and user_api_key:
            anthropic_key, openai_key, nvidia_key = "", "", user_api_key
        else:
            anthropic_key = settings.ANTHROPIC_API_KEY
            openai_key = settings.OPENAI_API_KEY
            nvidia_key = settings.NVIDIA_API_KEY

        output = process_transcript(
            transcript=transcript,
            output_format=output_format,
            anthropic_api_key=anthropic_key,
            openai_api_key=openai_key,
            nvidia_api_key=nvidia_key,
        )

        # 4. Save output to session
        db.execute(
            update(Session)
            .where(Session.id == session_row.id)
            .values(
                output_content=output,
                updated_at=datetime.now(timezone.utc),
            )
        )
        db.commit()

        # 5. Update job status to done
        db.execute(
            update(Job)
            .where(Job.id == job_uuid)
            .values(status="done", updated_at=datetime.now(timezone.utc))
        )
        db.commit()

        logger.info("Job %s completed successfully", job_id)
        return {"job_id": job_id, "status": "done"}

    except Exception as exc:
        db.rollback()
        logger.error("Job %s failed: %s", job_id, exc, exc_info=True)

        # Update job status to failed
        try:
            db.execute(
                update(Job)
                .where(Job.id == uuid.UUID(job_id))
                .values(
                    status="failed",
                    error_message=str(exc)[:1000],
                    updated_at=datetime.now(timezone.utc),
                )
            )
            db.commit()
        except Exception:
            logger.error("Failed to update job status for %s", job_id, exc_info=True)

        raise
    finally:
        db.close()

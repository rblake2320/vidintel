"""Fix empty SOP and Study output_content in DB.

Uses the existing process_transcript logic with NVIDIA NIM (since that's the
only API key present in .env). Falls back to Ollama if NVIDIA fails.
"""

import sys
import os
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# ── Add backend to path so we can import app modules ─────────────────
sys.path.insert(0, os.path.dirname(__file__))

# ── Config ────────────────────────────────────────────────────────────
SOP_JOB_ID   = "04fb2144-a17e-4386-85cc-5a64af1b520c"
SOP_SESSION_ID = "30a406c6-10d5-4657-8869-533db3defc6f"
STUDY_JOB_ID = "94e668e5-b6c9-4990-b4dc-8d165ba77c90"

# Sync DB URL (strip +asyncpg driver)
DB_URL_ASYNC = "postgresql+asyncpg://redteam:redteam@localhost:5432/vidintel"
DB_URL_SYNC  = DB_URL_ASYNC.replace("+asyncpg", "")

# Keys from .env
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")

import psycopg2
from psycopg2.extras import RealDictCursor


def get_connection():
    return psycopg2.connect(
        host="localhost",
        port=5432,
        dbname="vidintel",
        user="redteam",
        password="redteam",
    )


def get_transcript(conn) -> tuple[str, str]:
    """Return (transcript_text, study_session_id).

    Prefers the largest transcript for the same source video (4IyJm1i__ag).
    Also grabs the study session_id from the study job row.
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Find the longest transcript for this video
        cur.execute("""
            SELECT raw_transcript
            FROM sessions
            WHERE source_url LIKE '%4IyJm1i__ag%'
              AND raw_transcript IS NOT NULL
              AND raw_transcript != ''
            ORDER BY length(raw_transcript) DESC
            LIMIT 1
        """)
        row = cur.fetchone()
        if row and row["raw_transcript"]:
            transcript = row["raw_transcript"]
            log.info("Got transcript from video sessions (%d chars)", len(transcript))
        else:
            # Ultimate fallback: any session with raw_transcript
            cur.execute(
                "SELECT raw_transcript FROM sessions WHERE raw_transcript IS NOT NULL AND raw_transcript != '' ORDER BY length(raw_transcript) DESC LIMIT 1"
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("No session with raw_transcript found in DB")
            transcript = row["raw_transcript"]
            log.info("Got transcript from fallback session (%d chars)", len(transcript))

        # Get study job session_id
        cur.execute(
            "SELECT session_id FROM jobs WHERE id = %s::uuid",
            (STUDY_JOB_ID,),
        )
        study_row = cur.fetchone()
        study_session_id = study_row["session_id"] if study_row else None
        log.info("Study session_id: %s", study_session_id)

    return transcript, study_session_id


def verify_all_formats(conn):
    """Print output_len for all 4 formats (sessions for this video)."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # sessions table has output_format; jobs table does not
        cur.execute("""
            SELECT s.id as session_id, s.output_format, j.id as job_id, j.status,
                   length(s.output_content) as output_len
            FROM sessions s
            JOIN jobs j ON j.session_id = s.id
            WHERE s.source_url LIKE '%4IyJm1i__ag%'
            ORDER BY s.output_format
        """)
        rows = cur.fetchall()
        if not rows:
            log.warning("No rows via source_url filter — trying known job IDs")
            cur.execute("""
                SELECT s.id as session_id, s.output_format, j.id as job_id, j.status,
                       length(s.output_content) as output_len
                FROM sessions s
                JOIN jobs j ON j.session_id = s.id
                WHERE j.id IN (%s, %s)
            """, (SOP_JOB_ID, STUDY_JOB_ID))
            rows = cur.fetchall()
    return rows


def write_result(conn, session_id: str, job_id: str, content: str):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE sessions SET output_content = %s, updated_at = NOW() WHERE id = %s",
            (content, session_id),
        )
        cur.execute(
            "UPDATE jobs SET status = 'done', updated_at = NOW() WHERE id = %s",
            (job_id,),
        )
    conn.commit()
    log.info("Wrote %d chars to session %s / job %s", len(content), session_id, job_id)


def run_process(transcript: str, output_format: str) -> str:
    """Try NVIDIA first, fall back to Ollama."""
    from app.services.processor import process_transcript

    # Try NVIDIA NIM
    try:
        log.info("Trying NVIDIA NIM for format '%s'...", output_format)
        result = process_transcript(
            transcript,
            output_format,
            provider="nvidia",
            api_key=NVIDIA_API_KEY,
            model="meta/llama-3.1-70b-instruct",
        )
        if result and result.strip():
            log.info("NVIDIA succeeded (%d chars)", len(result))
            return result
        log.warning("NVIDIA returned empty result")
    except Exception as e:
        log.warning("NVIDIA failed: %s", e)

    # Fall back to Ollama (local, no key needed)
    try:
        log.info("Falling back to Ollama (gemma3:latest) for format '%s'...", output_format)
        result = process_transcript(
            transcript,
            output_format,
            provider="ollama",
            api_key="",
            model="gemma3:latest",
        )
        if result and result.strip():
            log.info("Ollama succeeded (%d chars)", len(result))
            return result
        log.warning("Ollama returned empty result")
    except Exception as e:
        log.warning("Ollama failed: %s", e)

    raise RuntimeError(f"All providers failed for format '{output_format}'")


def main():
    conn = get_connection()
    log.info("Connected to vidintel DB")

    # ── Check current state ────────────────────────────────────────────
    log.info("\n=== Current state of all 4 format jobs ===")
    rows = verify_all_formats(conn)
    for r in rows:
        log.info("  %-10s  status=%-6s  output_len=%s  job=%s",
                 r["output_format"], r["status"], r["output_len"] or 0, r["job_id"])

    # ── Get transcript ─────────────────────────────────────────────────
    transcript, study_session_id = get_transcript(conn)

    # ── Fix SOP ───────────────────────────────────────────────────────
    log.info("\n=== Processing SOP ===")
    sop_result = run_process(transcript, "sop")
    write_result(conn, SOP_SESSION_ID, SOP_JOB_ID, sop_result)

    # ── Fix Study ─────────────────────────────────────────────────────
    if not study_session_id:
        log.error("Could not find study session_id — aborting study fix")
    else:
        log.info("\n=== Processing Study ===")
        study_result = run_process(transcript, "study")
        write_result(conn, study_session_id, STUDY_JOB_ID, study_result)

    # ── Final verification ─────────────────────────────────────────────
    log.info("\n=== Final verification ===")
    # Re-query with broader scope
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT s.output_format, j.id as job_id, j.status,
                   length(s.output_content) as output_len
            FROM jobs j
            JOIN sessions s ON s.id = j.session_id
            ORDER BY j.created_at DESC
            LIMIT 20
        """)
        all_rows = cur.fetchall()

    for r in all_rows:
        log.info("  %-10s  status=%-6s  output_len=%s  job=%s",
                 r["output_format"], r["status"], r["output_len"] or 0, r["job_id"])

    conn.close()
    log.info("\nDone.")


if __name__ == "__main__":
    main()

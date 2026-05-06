"""
Direct fix: re-process SOP and study formats using cached transcript.
Uses NVIDIA API (key is in .env). Writes results directly to DB.
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

import psycopg2
from datetime import datetime, timezone

DB_URL = "postgresql://redteam:redteam@localhost:5432/vidintel"
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")

SOP_JOB_ID = "04fb2144-a17e-4386-85cc-5a64af1b520c"
SOP_SESSION_ID = "30a406c6-10d5-4657-8869-533db3defc6f"
STUDY_JOB_ID = "94e668e5-b6c9-4990-b4dc-8d165ba77c90"

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Get study session ID
cur.execute("SELECT session_id FROM jobs WHERE id = %s", (STUDY_JOB_ID,))
row = cur.fetchone()
if not row:
    print("ERROR: study job not found")
    sys.exit(1)
STUDY_SESSION_ID = str(row[0])
print(f"Study session ID: {STUDY_SESSION_ID}")

# Get transcript from bullets session (has raw_transcript cached) - use the longest one
cur.execute("""
    SELECT raw_transcript FROM sessions
    WHERE raw_transcript IS NOT NULL
    ORDER BY length(raw_transcript) DESC
    LIMIT 1
""")
row = cur.fetchone()
if not row:
    print("ERROR: no transcript found in DB")
    sys.exit(1)
transcript = row[0]
print(f"Transcript loaded: {len(transcript)} chars")

# Import processor
from app.services.processor import process_transcript

def fix_format(fmt, job_id, session_id):
    print(f"\n=== Processing {fmt} ===")
    try:
        output = process_transcript(
            transcript=transcript,
            output_format=fmt,
            provider="nvidia",
            api_key=NVIDIA_API_KEY,
            model="meta/llama-3.1-70b-instruct",
            max_tokens=4096,
        )
        print(f"{fmt} output: {len(output)} chars")

        cur.execute(
            "UPDATE sessions SET output_content = %s, updated_at = %s WHERE id = %s",
            (output, datetime.now(timezone.utc), session_id)
        )
        cur.execute(
            "UPDATE jobs SET status = 'done', updated_at = %s WHERE id = %s",
            (datetime.now(timezone.utc), job_id)
        )
        conn.commit()
        print(f"{fmt}: SAVED to DB OK")
        return len(output)
    except Exception as e:
        conn.rollback()
        print(f"{fmt} FAILED: {e}")
        raise

# Check current state
print("\n=== Current DB state ===")
for fmt, jid, sid in [
    ("sop", SOP_JOB_ID, SOP_SESSION_ID),
    ("study", STUDY_JOB_ID, STUDY_SESSION_ID),
]:
    cur.execute("SELECT status FROM jobs WHERE id = %s", (jid,))
    j = cur.fetchone()
    cur.execute("SELECT length(output_content) FROM sessions WHERE id = %s", (sid,))
    s = cur.fetchone()
    print(f"  {fmt}: job={j[0] if j else 'NOT FOUND'}, output_len={s[0] if s else 'NOT FOUND'}")

# Process SOP
sop_len = fix_format("sop", SOP_JOB_ID, SOP_SESSION_ID)

# Process study
study_len = fix_format("study", STUDY_JOB_ID, STUDY_SESSION_ID)

# Final verification
print("\n=== Final DB state (all 4 formats) ===")
cur.execute("""
    SELECT j.id, s.output_content IS NOT NULL,
           CASE WHEN s.output_content IS NOT NULL THEN length(s.output_content) ELSE 0 END,
           j.status
    FROM jobs j
    JOIN sessions s ON s.id = j.session_id
    WHERE j.id IN (
        '04fb2144-a17e-4386-85cc-5a64af1b520c',
        '94e668e5-b6c9-4990-b4dc-8d165ba77c90'
    )
""")
for row in cur.fetchall():
    print(f"  job={str(row[0])[:8]}: status={row[3]}, output_len={row[2]}")

# Also check bullets and concepts
cur.execute("""
    SELECT j.status,
           CASE WHEN s.output_content IS NOT NULL THEN length(s.output_content) ELSE 0 END
    FROM jobs j
    JOIN sessions s ON s.id = j.session_id
    WHERE j.id IN (
        '326bdd63-0000-0000-0000-000000000000',
        '62ae150d-0000-0000-0000-000000000000'
    )
""")
# Use approximate match
cur.execute("""
    SELECT j.id::text, j.status,
           CASE WHEN s.output_content IS NOT NULL THEN length(s.output_content) ELSE 0 END
    FROM jobs j
    JOIN sessions s ON s.id = j.session_id
    WHERE j.id::text NOT IN (
        '04fb2144-a17e-4386-85cc-5a64af1b520c',
        '94e668e5-b6c9-4990-b4dc-8d165ba77c90'
    )
    AND s.raw_transcript IS NOT NULL
    ORDER BY j.created_at DESC
    LIMIT 5
""")
print("\n  Other jobs with transcripts:")
for row in cur.fetchall():
    print(f"  job={row[0][:8]}: status={row[1]}, output_len={row[2]}")

cur.close()
conn.close()
print("\nDONE")

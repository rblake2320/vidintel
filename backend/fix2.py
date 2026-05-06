"""Fix SOP and study — runs synchronously, logs to file."""
import sys, os
sys.stdout = open("fix2.log", "w", buffering=1, encoding="utf-8")
sys.stderr = sys.stdout

sys.path.insert(0, os.path.dirname(__file__))

import psycopg2
from datetime import datetime, timezone

DB_URL = "postgresql://redteam:redteam@localhost:5432/vidintel"
NVIDIA_KEY = os.environ.get("NVIDIA_API_KEY", "")

SOP_JOB    = "04fb2144-a17e-4386-85cc-5a64af1b520c"
SOP_SES    = "30a406c6-10d5-4657-8869-533db3defc6f"
STUDY_JOB  = "94e668e5-b6c9-4990-b4dc-8d165ba77c90"
STUDY_SES  = "51c117dc-4a9d-4aeb-9c16-8c4bc2d5e319"

print("Connecting to DB...")
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

print("Getting transcript...")
cur.execute("""
    SELECT raw_transcript FROM sessions
    WHERE raw_transcript IS NOT NULL
    ORDER BY length(raw_transcript) DESC
    LIMIT 1
""")
row = cur.fetchone()
transcript = row[0]
print(f"Transcript: {len(transcript)} chars")

from app.services.processor import process_transcript

for fmt, job_id, ses_id in [
    ("sop",   SOP_JOB,   SOP_SES),
    ("study", STUDY_JOB, STUDY_SES),
]:
    print(f"\n--- {fmt} ---")
    output = process_transcript(
        transcript=transcript,
        output_format=fmt,
        provider="nvidia",
        api_key=NVIDIA_KEY,
        model="meta/llama-3.1-70b-instruct",
        max_tokens=4096,
    )
    print(f"Output: {len(output)} chars")
    if not output.strip():
        print("ERROR: empty output!")
        continue
    cur.execute(
        "UPDATE sessions SET output_content=%s, updated_at=%s WHERE id=%s",
        (output, datetime.now(timezone.utc), ses_id)
    )
    cur.execute(
        "UPDATE jobs SET status='done', error_message=NULL, updated_at=%s WHERE id=%s",
        (datetime.now(timezone.utc), job_id)
    )
    conn.commit()
    print(f"{fmt}: saved to DB")

print("\n=== Final check ===")
cur.execute("""
    SELECT j.id::text, j.status,
           coalesce(length(s.output_content),0) as out_len
    FROM jobs j JOIN sessions s ON s.id=j.session_id
    WHERE j.id IN (
        '04fb2144-a17e-4386-85cc-5a64af1b520c',
        '94e668e5-b6c9-4990-b4dc-8d165ba77c90'
    )
""")
for r in cur.fetchall():
    print(f"  {r[0][:8]}: status={r[1]}, output_len={r[2]}")

cur.close()
conn.close()
print("DONE")

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { submitBulk, getJobStatus, type OutputFormat, type JobStatusResponse } from "@/lib/api";

interface BulkJob {
  jobId: string;
  source: string;
  status: "pending" | "processing" | "done" | "failed";
  error?: string;
}

export default function BulkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [urls, setUrls] = useState("");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("bullets");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [polling, setPolling] = useState(false);

  // If arriving with ?jobs=... in URL, start polling
  useEffect(() => {
    const jobIds = searchParams.get("jobs");
    if (jobIds) {
      const parsed = jobIds.split(",").map((id) => ({
        jobId: id,
        source: "",
        status: "pending" as const,
      }));
      setJobs(parsed);
      setPolling(true);
    }
  }, [searchParams]);

  // Poll jobs
  useEffect(() => {
    if (!polling || jobs.length === 0) return;
    const token = getToken();
    if (!token) return;

    const interval = setInterval(async () => {
      const updated = await Promise.all(
        jobs.map(async (j) => {
          if (j.status === "done" || j.status === "failed") return j;
          try {
            const res = await getJobStatus(token, j.jobId);
            return { ...j, status: res.status as BulkJob["status"], error: res.error_message ?? undefined };
          } catch {
            return j;
          }
        }),
      );
      setJobs(updated);

      const allDone = updated.every((j) => j.status === "done" || j.status === "failed");
      if (allDone) {
        setPolling(false);
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [polling, jobs]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = getToken();
    if (!token) { router.push("/login"); return; }

    const lines = urls.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { setError("Enter at least one URL or transcript."); return; }
    if (lines.length > 50) { setError("Maximum 50 items per batch."); return; }

    setSubmitting(true);
    try {
      const items = lines.map((line) => ({
        source: line,
        source_type: line.match(/^https?:\/\//) ? "youtube" as const : "paste" as const,
        output_format: outputFormat,
      }));
      const res = await submitBulk(token, items);
      const bulkJobs = res.jobs.map((j, i) => ({
        jobId: j.job_id,
        source: lines[i] || "",
        status: j.status as BulkJob["status"],
      }));
      setJobs(bulkJobs);
      setPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit bulk jobs");
    } finally {
      setSubmitting(false);
    }
  }

  const doneCount = jobs.filter((j) => j.status === "done").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "var(--vi-space, 1rem) 1.25rem 3rem" }}>
      <div className="flex items-center justify-between mb-6 mt-4">
        <span className="vi-section-label">§ 04 BULK</span>
        <span className="vi-section-label">VID-INTEL / BATCH PROCESSING</span>
      </div>

      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: 4 }}>
        Bulk Processing
      </h1>
      <p style={{ color: "var(--vi-fg-muted)", fontSize: "0.82rem", marginBottom: "1.5rem" }}>
        Process up to 50 videos or transcripts in parallel.
      </p>

      {jobs.length === 0 ? (
        <form onSubmit={handleSubmit}>
          <div className="vi-card p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="vi-section-label">SOURCES — ONE PER LINE</span>
              <span style={{ fontSize: "0.65rem", color: "var(--vi-fg-muted)" }}>
                {urls.trim().split("\n").filter(Boolean).length} items
              </span>
            </div>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder={"https://youtube.com/watch?v=abc123\nhttps://youtube.com/watch?v=def456\nOr paste a transcript directly..."}
              rows={10}
              className="vi-input"
              style={{ resize: "vertical", fontFamily: "ui-monospace, monospace", fontSize: "0.8rem" }}
              required
            />
          </div>

          <div className="mb-4">
            <span className="vi-section-label mb-2 block">OUTPUT FORMAT (applies to all)</span>
            <div className="flex gap-2">
              {(["bullets", "sop", "study", "concepts"] as OutputFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOutputFormat(f)}
                  style={{
                    padding: "0.35rem 0.85rem",
                    borderRadius: 99,
                    fontSize: "0.75rem",
                    fontWeight: outputFormat === f ? 700 : 400,
                    background: outputFormat === f ? "var(--vi-fg)" : "var(--vi-input-bg)",
                    color: outputFormat === f ? "var(--vi-bg)" : "var(--vi-fg-muted)",
                    border: "none",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {f === "bullets" ? "Bullet Plan" : f === "sop" ? "SOP" : f === "study" ? "Study Guide" : "Key Concepts"}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ background: "rgba(196,83,42,0.1)", border: "1px solid var(--vi-accent)", borderRadius: 6, padding: "0.65rem 0.9rem", fontSize: "0.8rem", color: "var(--vi-accent)", marginBottom: 12 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !urls.trim()}
            className="vi-btn-primary w-full justify-center"
          >
            {submitting ? "Submitting..." : `Process ${urls.trim().split("\n").filter(Boolean).length} items`}
          </button>
        </form>
      ) : (
        /* ── Results grid ──────────────────────────── */
        <div>
          <div className="flex items-center gap-4 mb-4" style={{ fontSize: "0.78rem" }}>
            <span style={{ fontWeight: 700 }}>{doneCount}/{jobs.length} complete</span>
            {failedCount > 0 && <span style={{ color: "var(--vi-accent)" }}>{failedCount} failed</span>}
            {polling && <span style={{ color: "var(--vi-fg-muted)" }}>Processing...</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {jobs.map((j) => (
              <div key={j.jobId} className="vi-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: "0.65rem", fontFamily: "ui-monospace, monospace", color: "var(--vi-fg-muted)" }}>
                    {j.jobId.slice(0, 8)}
                  </span>
                  <StatusBadge status={j.status} />
                </div>
                <div style={{ fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 8 }}>
                  {j.source || "Job"}
                </div>
                {j.status === "done" && (
                  <button
                    onClick={() => router.push(`/output/${j.jobId}`)}
                    style={{ fontSize: "0.72rem", color: "var(--vi-accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    View output →
                  </button>
                )}
                {j.status === "failed" && j.error && (
                  <div style={{ fontSize: "0.68rem", color: "var(--vi-accent)", marginTop: 4 }}>{j.error}</div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => { setJobs([]); setUrls(""); }}
            className="vi-btn-ghost mt-4"
          >
            New batch
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    pending: { bg: "rgba(138,125,110,0.15)", fg: "var(--vi-fg-muted)" },
    processing: { bg: "rgba(196,83,42,0.15)", fg: "var(--vi-accent)" },
    done: { bg: "rgba(42,125,62,0.15)", fg: "#2a7d3e" },
    failed: { bg: "rgba(196,42,42,0.15)", fg: "#c42a2a" },
  };
  const c = colors[status] || colors.pending;
  return (
    <span style={{
      fontSize: "0.6rem",
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      padding: "0.15rem 0.5rem",
      borderRadius: 99,
      background: c.bg,
      color: c.fg,
    }}>
      {status}
    </span>
  );
}

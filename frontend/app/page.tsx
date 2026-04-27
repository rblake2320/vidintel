"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { submitJob, submitBulk, type OutputFormat, type SourceType } from "@/lib/api";

const FORMATS: { value: OutputFormat; num: string; label: string; desc: string; use: string }[] = [
  { value: "bullets", num: "01", label: "Bullet Plan", desc: "Numbered stages, sub-bullets, and gaps flagged.", use: "FOR BUILDERS CAPTURING TUTORIALS." },
  { value: "sop", num: "02", label: "Training Doc / SOP", desc: "Objective · action · why · watchouts, per step.", use: "FOR L&D AND ONBOARDING MATERIAL." },
  { value: "study", num: "03", label: "Study Guide", desc: "Concepts, frameworks, decisions, checklist.", use: "FOR LECTURES AND LONG-FORM COURSES." },
  { value: "concepts", num: "04", label: "Key Concepts", desc: "Named ideas, definitions, when to use.", use: "FOR TALKS AND PODCASTS." },
];

const EXAMPLES = [
  { label: "Karpathy · Software 3.0", url: "https://youtube.com/watch?v=LCEmiRjPEtQ" },
  { label: "Stanford CS231N · L6", url: "https://youtube.com/watch?v=wjZofJX0v4M" },
  { label: "Latent Space · Computer Use", url: "https://youtube.com/watch?v=example" },
];

type Mode = "single" | "bulk";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("single");
  const [source, setSource] = useState("");
  const [bulkSources, setBulkSources] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("youtube");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("bullets");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUrl = source.match(/^https?:\/\/(www\.)?youtu(\.be|be\.com)\//);
  const charCount = mode === "single" ? source.length : bulkSources.length;
  const wordCount = mode === "single"
    ? (source.trim() ? source.trim().split(/\s+/).length : 0)
    : bulkSources.trim().split("\n").filter(Boolean).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = getToken();
      if (!token) { router.push("/login"); return; }

      if (mode === "single") {
        const job = await submitJob(token, source, sourceType, outputFormat);
        router.push(`/processing/${job.job_id}`);
      } else {
        const lines = bulkSources.trim().split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) { setError("Enter at least one URL or transcript."); return; }
        if (lines.length > 50) { setError("Maximum 50 items per batch."); return; }
        const items = lines.map(line => ({
          source: line,
          source_type: line.match(/^https?:\/\//) ? "youtube" as const : "paste" as const,
          output_format: outputFormat,
        }));
        const res = await submitBulk(token, items);
        const jobIds = res.jobs.map(j => j.job_id).join(",");
        router.push(`/bulk?jobs=${jobIds}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setLoading(false);
    }
  }

  function handleSourceChange(val: string) {
    setSource(val);
    if (val.match(/^https?:\/\/(www\.)?youtu(\.be|be\.com)\//)) setSourceType("youtube");
    else if (val.length > 0 && !val.startsWith("http")) setSourceType("paste");
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 1.5rem 3rem" }}>

      {/* ── Section header with dotted line ──────────── */}
      <div
        className="flex items-center gap-3 mt-6 mb-4"
        style={{ fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.14em", color: "var(--vi-fg-muted)", textTransform: "uppercase" }}
      >
        <span style={{ whiteSpace: "nowrap" }}>§ 01 PROCESS</span>
        <span style={{ flex: 1, borderBottom: "1px dashed var(--vi-border)" }} />
        <span style={{ whiteSpace: "nowrap" }}>VID-INTEL / NEW SESSION</span>
      </div>

      {/* ── Mode toggle: Single / Bulk ───────────────── */}
      <div
        className="inline-flex mb-6"
        style={{ border: "1px solid var(--vi-fg)", borderRadius: 2, overflow: "hidden" }}
      >
        <button
          onClick={() => setMode("single")}
          style={{
            padding: "0.45rem 1rem",
            fontSize: "0.78rem",
            fontWeight: mode === "single" ? 600 : 400,
            background: mode === "single" ? "var(--vi-fg)" : "transparent",
            color: mode === "single" ? "var(--vi-bg)" : "var(--vi-fg)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: "0.6rem", fontWeight: 700, opacity: 0.5 }}>01</span>
          Single video
          <span style={{ fontSize: "0.58rem", opacity: 0.5 }}>one URL or transcript</span>
        </button>
        <button
          onClick={() => setMode("bulk")}
          style={{
            padding: "0.45rem 1rem",
            fontSize: "0.78rem",
            fontWeight: mode === "bulk" ? 600 : 400,
            background: mode === "bulk" ? "var(--vi-fg)" : "transparent",
            color: mode === "bulk" ? "var(--vi-bg)" : "var(--vi-fg)",
            border: "none",
            borderLeft: "1px solid var(--vi-fg)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: "0.6rem", fontWeight: 700, opacity: 0.5 }}>02</span>
          Bulk batch
          <span style={{ fontSize: "0.58rem", opacity: 0.5 }}>up to 50 in parallel</span>
          <span style={{
            fontSize: "0.5rem",
            fontWeight: 800,
            background: "var(--vi-accent)",
            color: "#fff",
            padding: "0.1rem 0.35rem",
            borderRadius: 2,
            letterSpacing: "0.06em",
          }}>
            NEW
          </span>
        </button>
      </div>

      {/* ── Hero headline ────────────────────────────── */}
      <h1 style={{
        fontSize: "clamp(2.4rem, 5.5vw, 3.8rem)",
        fontWeight: 300,
        lineHeight: 1.05,
        marginBottom: "1.2rem",
        letterSpacing: "-0.02em",
      }}>
        Turn any video into
        <br />
        <span
          className="vi-headline"
          style={{ fontSize: "clamp(2.4rem, 5.5vw, 3.8rem)", fontWeight: 400 }}
        >
          structured knowledge.
        </span>
      </h1>

      <p style={{
        color: "var(--vi-fg-muted)",
        fontSize: "0.92rem",
        lineHeight: 1.65,
        maxWidth: 560,
        marginBottom: "1.8rem",
      }}>
        Paste a YouTube URL or a raw transcript. Get a clean outline, SOP, study
        guide, or concept map in under 60 seconds — fluff stripped, gaps flagged,
        and every inferred step labelled.
      </p>

      {/* ── Stats bar ────────────────────────────────── */}
      <div
        className="flex items-center gap-8 mb-8"
        style={{
          fontSize: "0.6rem",
          fontWeight: 600,
          letterSpacing: "0.12em",
          color: "var(--vi-fg-muted)",
          textTransform: "uppercase",
        }}
      >
        <span><strong style={{ color: "var(--vi-fg)" }}>4</strong> OUTPUT MODES</span>
        <span><strong style={{ color: "var(--vi-fg)", textDecoration: "underline", textUnderlineOffset: 3 }}>3,000-TOKEN</strong> CHUNKING WITH OVERLAP</span>
        <span>CAPTIONS <span style={{ color: "var(--vi-accent)" }}>OR</span> WHISPER FALLBACK</span>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Source card ──────────────────────────────── */}
        <div
          className="vi-card mb-3"
          style={{ padding: "1rem 1.25rem", position: "relative" }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "var(--vi-fg-muted)",
                color: "var(--vi-bg)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.5rem",
                fontWeight: 800,
              }}>§</span>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                SOURCE
              </span>
              {mode === "single" && isUrl && (
                <span style={{
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  background: "#c04030",
                  color: "#fff",
                  padding: "0.12rem 0.5rem",
                  borderRadius: 3,
                  letterSpacing: "0.04em",
                }}>
                  YouTube URL detected
                </span>
              )}
              {mode === "single" && !isUrl && source.length > 0 && (
                <span style={{
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  background: "var(--vi-fg-muted)",
                  color: "var(--vi-bg)",
                  padding: "0.12rem 0.5rem",
                  borderRadius: 3,
                }}>
                  Transcript
                </span>
              )}
            </div>
            <span style={{ fontSize: "0.65rem", color: "var(--vi-fg-muted)", fontVariantNumeric: "tabular-nums" }}>
              {charCount} chars · {wordCount} {mode === "single" ? "words" : "items"}
            </span>
          </div>

          {mode === "single" ? (
            <textarea
              value={source}
              onChange={(e) => handleSourceChange(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              rows={4}
              className="vi-input"
              style={{
                resize: "vertical",
                fontFamily: "ui-monospace, 'SF Mono', monospace",
                fontSize: "0.88rem",
                border: "none",
                background: "transparent",
                padding: "0.5rem 0",
              }}
              required
            />
          ) : (
            <textarea
              value={bulkSources}
              onChange={(e) => setBulkSources(e.target.value)}
              placeholder={"https://youtube.com/watch?v=abc123\nhttps://youtube.com/watch?v=def456\nhttps://youtube.com/watch?v=ghi789"}
              rows={6}
              className="vi-input"
              style={{
                resize: "vertical",
                fontFamily: "ui-monospace, 'SF Mono', monospace",
                fontSize: "0.82rem",
                border: "none",
                background: "transparent",
                padding: "0.5rem 0",
              }}
              required
            />
          )}
        </div>

        {/* ── TRY examples ─────────────────────────────── */}
        {mode === "single" && (
          <div className="flex items-center gap-3 mb-8" style={{ fontSize: "0.72rem" }}>
            <span style={{ color: "var(--vi-fg-muted)", fontWeight: 700, letterSpacing: "0.08em", fontSize: "0.6rem" }}>
              TRY:
            </span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => { setSource(ex.url); setSourceType("youtube"); }}
                style={{
                  fontSize: "0.72rem",
                  padding: "0.3rem 0.75rem",
                  borderRadius: 99,
                  border: "1px solid var(--vi-border)",
                  background: "transparent",
                  color: "var(--vi-fg-muted)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span style={{ color: "var(--vi-accent)", fontSize: "0.55rem" }}>●</span>
                {ex.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Format selector ──────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "var(--vi-fg-muted)",
              color: "var(--vi-bg)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.5rem",
              fontWeight: 800,
            }}>§</span>
            <span style={{
              fontSize: "0.62rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: "var(--vi-fg-muted)",
              textTransform: "uppercase",
            }}>
              OUTPUT FORMAT — PICK ONE
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {FORMATS.map((f) => {
              const selected = outputFormat === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setOutputFormat(f.value)}
                  className="vi-card text-left relative"
                  style={{
                    padding: "1rem",
                    borderColor: selected ? "var(--vi-accent)" : undefined,
                    borderWidth: selected ? 2 : 1,
                    cursor: "pointer",
                    minHeight: 140,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Number + radio */}
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--vi-fg-muted)" }}>
                      {f.num}
                    </span>
                    <span style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: selected ? "none" : "1.5px solid var(--vi-border)",
                      background: selected ? "var(--vi-accent)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      {selected && (
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                      )}
                    </span>
                  </div>
                  {/* Title — serif */}
                  <div style={{
                    fontFamily: "var(--font-playfair, Georgia, serif)",
                    fontWeight: 600,
                    fontSize: "1rem",
                    marginBottom: 4,
                    lineHeight: 1.2,
                  }}>
                    {f.label}
                  </div>
                  {/* Description */}
                  <div style={{
                    fontSize: "0.72rem",
                    color: "var(--vi-fg-muted)",
                    lineHeight: 1.4,
                    flex: 1,
                  }}>
                    {f.desc}
                  </div>
                  {/* Use case */}
                  <div style={{
                    fontSize: "0.52rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "var(--vi-fg-muted)",
                    marginTop: 8,
                    opacity: 0.6,
                    textTransform: "uppercase",
                  }}>
                    {f.use}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Error ────────────────────────────────────── */}
        {error && (
          <div style={{
            background: "rgba(196,83,42,0.08)",
            border: "1px solid var(--vi-accent)",
            borderRadius: 4,
            padding: "0.6rem 0.9rem",
            fontSize: "0.8rem",
            color: "var(--vi-accent)",
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {/* ── Submit button (left-aligned, dark) ────────── */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading || (mode === "single" ? !source.trim() : !bulkSources.trim())}
            className="vi-btn-primary"
            style={{ fontSize: "0.88rem", padding: "0.8rem 1.6rem" }}
          >
            {loading ? "Processing..." : "Process video"}
            {!loading && <span style={{ opacity: 0.4, fontSize: "0.72rem", fontFamily: "ui-monospace, monospace" }}>⌘↵</span>}
          </button>

          <span style={{
            fontSize: "0.6rem",
            color: "var(--vi-fg-muted)",
            letterSpacing: "0.02em",
          }}>
            Free tier · <strong>10 / hour</strong> · auth via Supabase · processed async with Celery
          </span>
        </div>
      </form>
    </div>
  );
}

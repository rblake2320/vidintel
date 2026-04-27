"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { submitJob, type OutputFormat, type SourceType } from "@/lib/api";

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

export default function HomePage() {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("youtube");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("bullets");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUrl = source.match(/^https?:\/\/(www\.)?youtu(\.be|be\.com)\//);
  const charCount = source.length;
  const wordCount = source.trim() ? source.trim().split(/\s+/).length : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = getToken();
      if (!token) { router.push("/login"); return; }
      const job = await submitJob(token, source, sourceType, outputFormat);
      router.push(`/processing/${job.job_id}`);
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
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "var(--vi-space, 1rem) 1.25rem 3rem" }}>
      {/* Section header */}
      <div className="flex items-center justify-between mb-6 mt-4">
        <span className="vi-section-label">§ 01 PROCESS</span>
        <span className="vi-section-label">VID-INTEL / NEW SESSION</span>
      </div>

      {/* Hero headline */}
      <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 400, lineHeight: 1.05, marginBottom: "1rem" }}>
        Turn any video into
        <br />
        <span className="vi-headline" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>
          structured knowledge.
        </span>
      </h1>

      <p style={{ color: "var(--vi-fg-muted)", fontSize: "0.88rem", lineHeight: 1.6, maxWidth: 560, marginBottom: "1.5rem" }}>
        Paste a YouTube URL or a raw transcript. Get a clean outline, SOP, study
        guide, or concept map in under 60 seconds — fluff stripped, gaps flagged,
        and every inferred step labelled.
      </p>

      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-8" style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", color: "var(--vi-fg-muted)" }}>
        <span>4 OUTPUT MODES</span>
        <span>3,000-TOKEN CHUNKING WITH OVERLAP</span>
        <span>CAPTIONS OR WHISPER FALLBACK</span>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Source input */}
        <div className="vi-card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="vi-section-label">SOURCE</span>
              {isUrl && (
                <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "#2a7d3e", color: "#fff", padding: "0.15rem 0.5rem", borderRadius: 99 }}>
                  YouTube URL detected
                </span>
              )}
              {!isUrl && source.length > 0 && (
                <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "var(--vi-accent)", color: "#fff", padding: "0.15rem 0.5rem", borderRadius: 99 }}>
                  Transcript
                </span>
              )}
            </div>
            <span style={{ fontSize: "0.65rem", color: "var(--vi-fg-muted)", fontVariantNumeric: "tabular-nums" }}>
              {charCount} chars · {wordCount} words
            </span>
          </div>

          {/* Source type toggle */}
          <div className="flex gap-1 mb-3">
            <button
              type="button"
              onClick={() => setSourceType("youtube")}
              style={{
                fontSize: "0.72rem",
                padding: "0.3rem 0.75rem",
                borderRadius: 99,
                fontWeight: sourceType === "youtube" ? 700 : 400,
                background: sourceType === "youtube" ? "var(--vi-fg)" : "transparent",
                color: sourceType === "youtube" ? "var(--vi-bg)" : "var(--vi-fg-muted)",
                border: "none",
                cursor: "pointer",
              }}
            >
              YouTube URL
            </button>
            <button
              type="button"
              onClick={() => setSourceType("paste")}
              style={{
                fontSize: "0.72rem",
                padding: "0.3rem 0.75rem",
                borderRadius: 99,
                fontWeight: sourceType === "paste" ? 700 : 400,
                background: sourceType === "paste" ? "var(--vi-fg)" : "transparent",
                color: sourceType === "paste" ? "var(--vi-bg)" : "var(--vi-fg-muted)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Paste Transcript
            </button>
          </div>

          {sourceType === "youtube" ? (
            <input
              type="url"
              value={source}
              onChange={(e) => handleSourceChange(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="vi-input"
              required
            />
          ) : (
            <textarea
              value={source}
              onChange={(e) => handleSourceChange(e.target.value)}
              placeholder="Paste your transcript here..."
              rows={6}
              className="vi-input"
              style={{ resize: "vertical", minHeight: 120 }}
              required
            />
          )}
        </div>

        {/* Example URLs */}
        <div className="flex items-center gap-3 mb-8" style={{ fontSize: "0.72rem" }}>
          <span style={{ color: "var(--vi-fg-muted)", fontWeight: 600, letterSpacing: "0.05em" }}>TRY:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => { setSource(ex.url); setSourceType("youtube"); }}
              style={{
                fontSize: "0.7rem",
                padding: "0.25rem 0.65rem",
                borderRadius: 99,
                border: "1px solid var(--vi-border)",
                background: "transparent",
                color: "var(--vi-fg-muted)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ color: "var(--vi-accent)", fontSize: "0.5rem" }}>●</span>
              {ex.label}
            </button>
          ))}
        </div>

        {/* Format selector */}
        <div className="mb-4">
          <span className="vi-section-label flex items-center gap-2 mb-3">
            OUTPUT FORMAT — PICK ONE
          </span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setOutputFormat(f.value)}
                className="vi-card text-left p-4 relative"
                style={{
                  borderColor: outputFormat === f.value ? "var(--vi-accent)" : undefined,
                  borderWidth: outputFormat === f.value ? 2 : 1,
                  cursor: "pointer",
                  minHeight: 120,
                }}
              >
                <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--vi-fg-muted)" }}>{f.num}</span>
                {outputFormat === f.value && (
                  <span style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "var(--vi-accent)",
                    border: "3px solid var(--vi-bg-card)",
                    display: "block",
                  }} />
                )}
                <div style={{ fontWeight: 700, fontSize: "0.88rem", marginTop: 4 }}>{f.label}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--vi-fg-muted)", marginTop: 4, lineHeight: 1.4 }}>{f.desc}</div>
                <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--vi-fg-muted)", marginTop: 8, opacity: 0.7 }}>
                  {f.use}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(196,83,42,0.1)", border: "1px solid var(--vi-accent)", borderRadius: 6, padding: "0.65rem 0.9rem", fontSize: "0.8rem", color: "var(--vi-accent)", marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !source.trim()}
          className="vi-btn-primary w-full justify-center"
        >
          {loading ? "Processing..." : "Process video"}
          {!loading && <span style={{ opacity: 0.5, fontSize: "0.7rem" }}>⌘↵</span>}
        </button>

        {/* Footer info */}
        <div className="text-center mt-3" style={{ fontSize: "0.6rem", color: "var(--vi-fg-muted)", letterSpacing: "0.03em" }}>
          Free tier · 10 / hour · auth via JWT · processed async with Celery
        </div>
      </form>
    </div>
  );
}

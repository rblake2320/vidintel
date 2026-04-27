"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getJobStatus, downloadMarkdown, downloadPdf, type JobStatusResponse } from "@/lib/api";
import { getToken } from "@/lib/auth";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[-*+]\s/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .trim();
}

export default function OutputPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    async function load() {
      const accessToken = getToken();
      if (!accessToken) { router.push("/login"); return; }
      setToken(accessToken);
      try {
        const result = await getJobStatus(accessToken, jobId);
        setJob(result);
      } catch { router.push("/"); }
      finally { setLoading(false); }
    }
    load();
  }, [jobId, router]);

  async function handleDownloadMd() {
    if (!token) return;
    const blob = await downloadMarkdown(token, jobId);
    triggerDownload(blob, `vidintel-${jobId.slice(0, 8)}.md`);
  }

  async function handleDownloadPdf() {
    if (!token) return;
    setDownloadingPdf(true);
    try {
      const blob = await downloadPdf(token, jobId);
      triggerDownload(blob, `vidintel-${jobId.slice(0, 8)}.pdf`);
    } finally { setDownloadingPdf(false); }
  }

  function handleReadAloud() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    if (!job?.output_content) return;
    const text = stripMarkdown(job.output_content);
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  useEffect(() => {
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "4rem 1.25rem", textAlign: "center", color: "var(--vi-fg-muted)" }}>
        Loading...
      </div>
    );
  }

  if (!job || job.status !== "done") {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "4rem 1.25rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--vi-accent)", marginBottom: 8 }}>
          {job?.status === "failed" ? "Processing Failed" : "Job Not Ready"}
        </h1>
        {job?.error_message && (
          <p style={{ color: "var(--vi-fg-muted)", fontSize: "0.85rem" }}>{job.error_message}</p>
        )}
        <button onClick={() => router.push("/")} className="vi-btn-primary mt-4">Try Again</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "var(--vi-space, 1rem) 1.25rem 3rem" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 mt-4">
        <span className="vi-section-label">§ 03 OUTPUT</span>
        <span className="vi-section-label">JOB {jobId.slice(0, 8).toUpperCase()}</span>
      </div>

      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "1rem" }}>Results</h1>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button onClick={handleDownloadMd} className="vi-btn-ghost">Download .md</button>
        <button
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          className="vi-btn-ghost"
        >
          {downloadingPdf ? "Generating..." : "Download .pdf"}
        </button>
        <button onClick={handleReadAloud} className="vi-btn-ghost">
          {speaking ? "Stop reading" : "Read aloud"}
        </button>
        <button onClick={() => router.push("/")} className="vi-btn-ghost">New Analysis</button>
      </div>

      {/* Output content */}
      <div className="vi-card p-6 vi-prose" style={{ fontSize: "0.88rem" }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {job.output_content ?? ""}
        </ReactMarkdown>
      </div>

      <p style={{ fontSize: "0.65rem", color: "var(--vi-fg-muted)", marginTop: 12 }}>
        Processed at {new Date(job.updated_at).toLocaleString()}
      </p>
    </div>
  );
}

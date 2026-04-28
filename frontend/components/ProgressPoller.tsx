"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getJobStatus } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface ProgressPollerProps {
  jobId: string;
}

export default function ProgressPoller({ jobId }: ProgressPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const token = getToken();
        if (!token) {
          router.push("/login");
          return;
        }

        const job = await getJobStatus(token, jobId);
        if (cancelled) return;

        setStatus(job.status);

        if (job.status === "done") {
          router.push(`/output/${jobId}`);
          return;
        }

        if (job.status === "failed") {
          setError(job.error_message || "Processing failed");
          return;
        }

        setTimeout(poll, 2000);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Polling failed");
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [jobId, router]);

  const isFailed = status === "failed" || !!error;
  const progress = status === "pending" ? 25 : status === "processing" ? 65 : isFailed ? 0 : 100;

  if (isFailed) {
    return (
      <div className="max-w-md mx-auto">
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            padding: "1.25rem",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ color: "#ef4444", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              ✕ Processing Failed
            </span>
          </div>
          <div
            style={{
              color: "#b91c1c",
              fontSize: "0.78rem",
              fontFamily: "monospace",
              wordBreak: "break-word",
              maxHeight: 120,
              overflowY: "auto",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={() => router.push("/")}
            className="vi-btn-primary"
            style={{ fontSize: "0.82rem", padding: "0.45rem 1.1rem" }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600 capitalize">{status}...</span>
          <span className="text-gray-400">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-brand-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

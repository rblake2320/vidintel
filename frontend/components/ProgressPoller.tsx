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

  const progress = status === "pending" ? 25 : status === "processing" ? 65 : 100;

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
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

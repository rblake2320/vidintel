import { getSettings } from "./settings";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type OutputFormat = "bullets" | "sop" | "study" | "concepts";
export type SourceType = "youtube" | "paste";

export interface JobResponse {
  job_id: string;
  session_id: string;
  status: string;
}

export interface JobStatusResponse {
  job_id: string;
  session_id: string;
  status: string;
  error_message: string | null;
  output_content: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionResponse {
  id: string;
  source_url: string | null;
  source_type: string;
  output_format: string;
  output_content: string | null;
  job_status: string | null;
  job_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface BulkResponse {
  jobs: JobResponse[];
  total: number;
}

export interface UsageResponse {
  jobs_this_hour: number;
  limit_per_hour: number;
}

// ── Client-side hourly job cap ────────────────────────────────────
const CAP_KEY = "vidintel_job_cap";

interface CapRecord { count: number; windowStart: number; }

function getCapRecord(): CapRecord {
  try {
    const raw = localStorage.getItem(CAP_KEY);
    if (raw) return JSON.parse(raw) as CapRecord;
  } catch { /* ignore */ }
  return { count: 0, windowStart: Date.now() };
}

function incrementCapRecord(): CapRecord {
  const now = Date.now();
  let rec = getCapRecord();
  if (now - rec.windowStart > 3_600_000) rec = { count: 0, windowStart: now };
  rec.count += 1;
  localStorage.setItem(CAP_KEY, JSON.stringify(rec));
  return rec;
}

export function checkJobCap(): { blocked: boolean; used: number; cap: number } {
  const s = getSettings();
  const cap = s.jobsPerHourCap;
  if (!cap) return { blocked: false, used: 0, cap: 0 };
  const now = Date.now();
  const rec = getCapRecord();
  const used = now - rec.windowStart > 3_600_000 ? 0 : rec.count;
  return { blocked: used >= cap, used, cap };
}

// ─────────────────────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  // Inject user LLM settings if configured
  const s = getSettings();
  if (s.llmProvider) {
    headers["X-LLM-Provider"] = s.llmProvider;
    if (s.apiKey) headers["X-LLM-Key"] = s.apiKey;
    if (s.model) headers["X-LLM-Model"] = s.model;
  }
  if (s.maxTokens > 0) headers["X-LLM-Max-Tokens"] = String(s.maxTokens);
  return headers;
}

export async function submitJob(
  token: string,
  source: string,
  sourceType: SourceType,
  outputFormat: OutputFormat,
): Promise<JobResponse> {
  const capCheck = checkJobCap();
  if (capCheck.blocked) {
    throw new Error(
      `Spending cap: you've used ${capCheck.used}/${capCheck.cap} jobs this hour. ` +
      `Increase or clear the cap in Tweaks → Spending Controls.`
    );
  }
  const res = await fetch(`${API_URL}/api/process`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ source, source_type: sourceType, output_format: outputFormat }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to submit job");
  }
  incrementCapRecord();
  return res.json();
}

export async function submitBulk(
  token: string,
  items: { source: string; source_type: SourceType; output_format: OutputFormat }[],
): Promise<BulkResponse> {
  const capCheck = checkJobCap();
  if (capCheck.blocked) {
    throw new Error(
      `Spending cap: you've used ${capCheck.used}/${capCheck.cap} jobs this hour. ` +
      `Increase or clear the cap in Tweaks → Spending Controls.`
    );
  }
  const res = await fetch(`${API_URL}/api/bulk`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to submit bulk jobs");
  }
  return res.json();
}

export async function getJobStatus(token: string, jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${API_URL}/api/jobs/${jobId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch job status");
  return res.json();
}

export async function getSessions(token: string): Promise<SessionResponse[]> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

export async function deleteSession(token: string, sessionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to delete session");
}

export async function getUsage(token: string): Promise<UsageResponse> {
  const res = await fetch(`${API_URL}/api/usage`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch usage");
  return res.json();
}

export async function downloadMarkdown(token: string, jobId: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/jobs/${jobId}/download/md`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to download Markdown");
  return res.blob();
}

export async function downloadPdf(token: string, jobId: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/jobs/${jobId}/download/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to download PDF");
  return res.blob();
}

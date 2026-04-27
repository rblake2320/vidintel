"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { getSessions, deleteSession, type SessionResponse } from "@/lib/api";

const FORMAT_LABELS: Record<string, string> = {
  bullets: "Bullet Plan",
  sop: "SOP",
  study: "Study Guide",
  concepts: "Key Concepts",
};

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token) { router.push("/login"); return; }
      try {
        const data = await getSessions(token);
        setSessions(data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, [router]);

  async function handleDelete(sessionId: string) {
    const token = getToken();
    if (!token) return;
    try {
      await deleteSession(token, sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "4rem 1.25rem", textAlign: "center", color: "var(--vi-fg-muted)" }}>
        Loading history...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "var(--vi-space, 1rem) 1.25rem 3rem" }}>
      <div className="flex items-center justify-between mb-6 mt-4">
        <span className="vi-section-label">§ 02 SESSIONS</span>
        <span className="vi-section-label">VID-INTEL / HISTORY</span>
      </div>

      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "1.5rem" }}>Session History</h1>

      {sessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--vi-fg-muted)" }}>
          <p style={{ fontSize: "0.9rem", marginBottom: 12 }}>No sessions yet.</p>
          <button onClick={() => router.push("/")} className="vi-btn-primary">
            Create Your First Analysis
          </button>
        </div>
      ) : (
        <div className="vi-card overflow-hidden">
          <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--vi-border)" }}>
                <th style={{ padding: "0.65rem 0.9rem", textAlign: "left", fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--vi-fg-muted)", textTransform: "uppercase" }}>Source</th>
                <th style={{ padding: "0.65rem 0.9rem", textAlign: "left", fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--vi-fg-muted)", textTransform: "uppercase" }}>Format</th>
                <th style={{ padding: "0.65rem 0.9rem", textAlign: "left", fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--vi-fg-muted)", textTransform: "uppercase" }}>Date</th>
                <th style={{ padding: "0.65rem 0.9rem", textAlign: "right", fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--vi-fg-muted)", textTransform: "uppercase" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--vi-border)" }}>
                  <td style={{ padding: "0.65rem 0.9rem", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.source_url || "Pasted transcript"}
                  </td>
                  <td style={{ padding: "0.65rem 0.9rem" }}>
                    <span className="vi-badge" style={{ color: "var(--vi-accent)" }}>
                      {FORMAT_LABELS[s.output_format] || s.output_format}
                    </span>
                  </td>
                  <td style={{ padding: "0.65rem 0.9rem", color: "var(--vi-fg-muted)" }}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "0.65rem 0.9rem", textAlign: "right" }}>
                    {s.output_content && (
                      <button
                        onClick={() => router.push(`/output/${s.id}`)}
                        style={{ color: "var(--vi-accent)", background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, marginRight: 10 }}
                      >
                        View
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(s.id)}
                      style={{ color: "var(--vi-fg-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

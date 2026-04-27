"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSettings,
  saveSettings,
  type VidIntelSettings,
  type Theme,
  type Density,
  type LLMProvider,
} from "@/lib/settings";

interface TweaksPanelProps {
  open: boolean;
  onClose: () => void;
}

const MODEL_OPTIONS: Record<string, string[]> = {
  nvidia: ["meta/llama-3.1-8b-instruct", "meta/llama-3.1-70b-instruct", "mistralai/mixtral-8x7b-instruct-v01"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  anthropic: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
};

export default function TweaksPanel({ open, onClose }: TweaksPanelProps) {
  const router = useRouter();
  const [s, setS] = useState<VidIntelSettings>(getSettings());

  useEffect(() => {
    setS(getSettings());
  }, [open]);

  function update(partial: Partial<VidIntelSettings>) {
    const next = { ...s, ...partial };
    setS(next);
    saveSettings(partial);
  }

  if (!open) return null;

  return (
    <div
      className="fixed top-0 right-0 h-full w-[300px] z-40 animate-slide-in overflow-y-auto"
      style={{
        background: "var(--vi-bg-card)",
        borderLeft: "1px solid var(--vi-border)",
        boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
      }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Tweaks</span>
          <button
            onClick={onClose}
            style={{ color: "var(--vi-fg-muted)", fontSize: "1.1rem", background: "none", border: "none", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        {/* ── THEME ─────────────────────────────── */}
        <Section title="THEME">
          <div className="flex gap-3 items-center">
            <Swatch label="Accent" color="#C4532A" />
            <ThemeBtn label="Paper" active={s.theme === "paper"} onClick={() => update({ theme: "paper" })} bg="#F0E8D5" fg="#1C1814" />
            <ThemeBtn label="Ink" active={s.theme === "ink"} onClick={() => update({ theme: "ink" })} bg="#141210" fg="#F0E8D5" />
          </div>
        </Section>

        {/* ── DENSITY ───────────────────────────── */}
        <Section title="DENSITY">
          <div className="flex gap-2">
            {(["compact", "comfortable", "editorial"] as Density[]).map((d) => (
              <button
                key={d}
                onClick={() => update({ density: d })}
                style={{
                  padding: "0.3rem 0.7rem",
                  borderRadius: 99,
                  fontSize: "0.72rem",
                  fontWeight: s.density === d ? 700 : 400,
                  background: s.density === d ? "var(--vi-fg)" : "var(--vi-input-bg)",
                  color: s.density === d ? "var(--vi-bg)" : "var(--vi-fg-muted)",
                  border: "none",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </Section>

        {/* ── READING ───────────────────────────── */}
        <Section title="READING">
          <Toggle label="Line numbers" checked={s.lineNumbers} onChange={(v) => update({ lineNumbers: v })} />
          <Toggle label="Mono marks" checked={s.monoMarks} onChange={(v) => update({ monoMarks: v })} />
        </Section>

        {/* ── API KEYS ──────────────────────────── */}
        <Section title="LLM SETTINGS">
          <label style={{ fontSize: "0.72rem", color: "var(--vi-fg-muted)", display: "block", marginBottom: 4 }}>
            Provider
          </label>
          <select
            value={s.llmProvider}
            onChange={(e) => update({ llmProvider: e.target.value as LLMProvider, model: "" })}
            className="vi-input mb-3"
            style={{ fontSize: "0.8rem" }}
          >
            <option value="">Server default</option>
            <option value="nvidia">NVIDIA</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>

          {s.llmProvider && (
            <>
              <label style={{ fontSize: "0.72rem", color: "var(--vi-fg-muted)", display: "block", marginBottom: 4 }}>
                API Key
              </label>
              <input
                type="password"
                value={s.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
                placeholder={s.llmProvider === "nvidia" ? "nvapi-..." : s.llmProvider === "openai" ? "sk-..." : "sk-ant-..."}
                className="vi-input mb-3"
                style={{ fontSize: "0.8rem" }}
              />

              <label style={{ fontSize: "0.72rem", color: "var(--vi-fg-muted)", display: "block", marginBottom: 4 }}>
                Model
              </label>
              <select
                value={s.model}
                onChange={(e) => update({ model: e.target.value })}
                className="vi-input mb-3"
                style={{ fontSize: "0.8rem" }}
              >
                <option value="">Default</option>
                {(MODEL_OPTIONS[s.llmProvider] || []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </>
          )}
        </Section>

        {/* ── DEMO JUMPS ────────────────────────── */}
        <Section title="DEMO">
          {[
            { label: "Jump to processing", href: "/" },
            { label: "Jump to output", href: "/history" },
            { label: "Jump to history", href: "/history" },
            { label: "Jump to bulk", href: "/bulk" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => { router.push(item.href); onClose(); }}
              style={{
                display: "block",
                width: "100%",
                padding: "0.45rem 0.75rem",
                marginBottom: 6,
                borderRadius: 4,
                fontSize: "0.75rem",
                fontWeight: 600,
                background: "var(--vi-fg)",
                color: "var(--vi-bg)",
                border: "none",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              {item.label}
            </button>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div
        style={{
          fontSize: "0.6rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: "var(--vi-fg-muted)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: 28, height: 28, borderRadius: 4, background: color, border: "1px solid var(--vi-border)" }} />
      <span style={{ fontSize: "0.6rem", color: "var(--vi-fg-muted)" }}>{label}</span>
    </div>
  );
}

function ThemeBtn({ label, active, onClick, bg, fg }: { label: string; active: boolean; onClick: () => void; bg: string; fg: string }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1"
      style={{ background: "none", border: "none", cursor: "pointer" }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          background: bg,
          border: active ? `2px solid ${fg}` : "1px solid var(--vi-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.5rem",
          color: fg,
        }}
      >
        Aa
      </div>
      <span style={{ fontSize: "0.6rem", color: "var(--vi-fg-muted)" }}>{label}</span>
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span style={{ fontSize: "0.78rem" }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? "var(--vi-accent)" : "var(--vi-border)",
          border: "none",
          cursor: "pointer",
          position: "relative",
          transition: "background 0.15s",
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 3,
            left: checked ? 19 : 3,
            transition: "left 0.15s",
          }}
        />
      </button>
    </div>
  );
}

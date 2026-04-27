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
  anthropic: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  openai: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o3", "o3-pro", "o3-mini", "o4-mini"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "meta-llama/llama-4-scout-17b-16e-instruct", "gemma2-9b-it"],
  together: ["Qwen/Qwen3.5-397B-A17B", "deepseek-ai/DeepSeek-V4-Pro", "deepseek-ai/DeepSeek-R1", "meta-llama/Llama-3.3-70B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo"],
  mistral: ["mistral-large-latest", "mistral-small-latest", "devstral-2512", "codestral-latest"],
  deepseek: ["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"],
  xai: ["grok-4.20", "grok-4.20-reasoning", "grok-4.1-fast-reasoning", "grok-3-beta", "grok-3-mini-beta"],
  openrouter: ["meta-llama/llama-3.3-70b-instruct", "anthropic/claude-sonnet-4", "openai/gpt-5.4", "google/gemini-2.5-pro", "deepseek/deepseek-r1", "qwen/qwen-2.5-72b-instruct"],
  nvidia: ["meta/llama-3.1-8b-instruct", "meta/llama-3.1-70b-instruct", "mistralai/mixtral-8x7b-instruct-v01"],
  huggingface: ["meta-llama/Llama-3.3-70B-Instruct", "Qwen/Qwen2.5-72B-Instruct", "mistralai/Mixtral-8x7B-Instruct-v0.1", "google/gemma-2-27b-it"],
  ollama: ["gemma4:9b", "gemma3:latest", "llama3.3:70b", "llama3.1:latest", "deepseek-r1:32b", "deepseek-r1:7b", "qwen3:14b", "qwen2.5-coder:32b", "mistral:latest"],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
  openrouter: "OpenRouter (200+ models)",
  groq: "Groq (fast)",
  together: "Together AI",
  mistral: "Mistral",
  deepseek: "DeepSeek",
  xai: "xAI (Grok)",
  nvidia: "NVIDIA NIM",
  huggingface: "Hugging Face",
  ollama: "Ollama (local · free)",
};

const KEY_HINTS: Record<string, string> = {
  anthropic: "sk-ant-...",
  openai: "sk-...",
  google: "AIza...",
  openrouter: "sk-or-...",
  groq: "gsk_...",
  together: "...",
  mistral: "...",
  deepseek: "sk-...",
  xai: "xai-...",
  nvidia: "nvapi-...",
  huggingface: "hf_...",
  ollama: "",
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
            onChange={(e) => update({ llmProvider: e.target.value as LLMProvider, model: "", apiKey: e.target.value === "ollama" ? "" : s.apiKey })}
            className="vi-input mb-3"
            style={{ fontSize: "0.8rem" }}
          >
            <option value="">Server default</option>
            <optgroup label="Cloud Providers">
              {["anthropic", "openai", "google", "openrouter", "groq", "together", "mistral", "deepseek", "xai", "nvidia", "huggingface"].map((p) => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </optgroup>
            <optgroup label="Local (free)">
              <option value="ollama">{PROVIDER_LABELS.ollama}</option>
            </optgroup>
          </select>

          {s.llmProvider && (
            <>
              {s.llmProvider !== "ollama" && (
                <>
                  <label style={{ fontSize: "0.72rem", color: "var(--vi-fg-muted)", display: "block", marginBottom: 4 }}>
                    API Key
                  </label>
                  <input
                    type="password"
                    value={s.apiKey}
                    onChange={(e) => update({ apiKey: e.target.value })}
                    placeholder={KEY_HINTS[s.llmProvider] || "..."}
                    className="vi-input mb-3"
                    style={{ fontSize: "0.8rem" }}
                  />
                </>
              )}
              {s.llmProvider === "ollama" && (
                <div style={{ fontSize: "0.68rem", color: "var(--vi-fg-muted)", marginBottom: 8, padding: "0.4rem 0.6rem", background: "rgba(42,125,62,0.08)", borderRadius: 4 }}>
                  Free — runs on your machine via Ollama. No API key needed.
                </div>
              )}

              <label style={{ fontSize: "0.72rem", color: "var(--vi-fg-muted)", display: "block", marginBottom: 4 }}>
                Model (pick or type)
              </label>
              <select
                value={(MODEL_OPTIONS[s.llmProvider] || []).includes(s.model) ? s.model : ""}
                onChange={(e) => update({ model: e.target.value })}
                className="vi-input mb-2"
                style={{ fontSize: "0.8rem" }}
              >
                <option value="">Default</option>
                {(MODEL_OPTIONS[s.llmProvider] || []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input
                type="text"
                value={s.model}
                onChange={(e) => update({ model: e.target.value })}
                placeholder="or type: ft:gpt-4o:my-org:abc, my-finetuned-model..."
                className="vi-input mb-1"
                style={{ fontSize: "0.72rem", fontFamily: "ui-monospace, monospace" }}
              />
              <div style={{ fontSize: "0.58rem", color: "var(--vi-fg-muted)", marginBottom: 8, opacity: 0.7 }}>
                Type any model ID — works with fine-tuned, custom, or trained models
              </div>
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

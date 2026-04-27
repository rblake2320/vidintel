export type Theme = "paper" | "ink";
export type Density = "compact" | "comfortable" | "editorial";
export type LLMProvider =
  | "anthropic" | "openai" | "google" | "openrouter" | "groq" | "together"
  | "mistral" | "deepseek" | "xai" | "nvidia" | "ollama" | "huggingface" | "";

export interface VidIntelSettings {
  theme: Theme;
  density: Density;
  lineNumbers: boolean;
  monoMarks: boolean;
  llmProvider: LLMProvider;
  apiKey: string;
  model: string;
}

const DEFAULTS: VidIntelSettings = {
  theme: "paper",
  density: "comfortable",
  lineNumbers: true,
  monoMarks: true,
  llmProvider: "",
  apiKey: "",
  model: "",
};

const KEY = "vidintel_settings";

export function getSettings(): VidIntelSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(partial: Partial<VidIntelSettings>): void {
  const next = { ...getSettings(), ...partial };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("vidintel-settings-changed"));
}

export function applyThemeToBody(s: VidIntelSettings) {
  document.body.setAttribute("data-theme", s.theme);
  document.body.setAttribute("data-density", s.density);
}

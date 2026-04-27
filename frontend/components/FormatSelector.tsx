"use client";

import type { OutputFormat } from "@/lib/api";

const FORMAT_OPTIONS: { value: OutputFormat; label: string; desc: string }[] = [
  { value: "bullets", label: "Bullet Plan", desc: "Actionable bullet points by stage" },
  { value: "sop", label: "SOP", desc: "Structured training document with steps" },
  { value: "study", label: "Study Guide", desc: "Concepts, frameworks, and checklists" },
  { value: "concepts", label: "Key Concepts", desc: "Named concepts with definitions" },
];

interface FormatSelectorProps {
  value: OutputFormat;
  onChange: (format: OutputFormat) => void;
}

export default function FormatSelector({ value, onChange }: FormatSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {FORMAT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`p-4 rounded-lg border-2 text-left transition-colors ${
            value === opt.value
              ? "border-brand-500 bg-brand-50"
              : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <div className="font-semibold text-sm">{opt.label}</div>
          <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
        </button>
      ))}
    </div>
  );
}

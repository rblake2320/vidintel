"use client";

import { useEffect, useState } from "react";
import Navbar from "./Navbar";
import TweaksPanel from "./TweaksPanel";
import { getSettings, applyThemeToBody, type VidIntelSettings } from "@/lib/settings";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [settings, setSettings] = useState<VidIntelSettings>(getSettings());

  // Apply theme on mount and on settings change
  useEffect(() => {
    applyThemeToBody(settings);
  }, [settings]);

  // Listen for settings changes from TweaksPanel
  useEffect(() => {
    const handler = () => {
      const s = getSettings();
      setSettings(s);
      applyThemeToBody(s);
    };
    window.addEventListener("vidintel-settings-changed", handler);
    return () => window.removeEventListener("vidintel-settings-changed", handler);
  }, []);

  return (
    <>
      <Navbar onTweaksClick={() => setTweaksOpen((o) => !o)} />
      <main className="min-h-[calc(100vh-52px)]">{children}</main>
      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} />
      {tweaksOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setTweaksOpen(false)}
          aria-hidden
        />
      )}
    </>
  );
}

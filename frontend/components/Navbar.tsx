"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUser, logout, type AuthUser } from "@/lib/auth";
import { getUsage } from "@/lib/api";

interface NavbarProps {
  onTweaksClick: () => void;
}

export default function Navbar({ onTweaksClick }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<{ jobs_this_hour: number; limit_per_hour: number } | null>(null);

  useEffect(() => {
    setUser(getUser());
    const handler = () => setUser(getUser());
    window.addEventListener("vidintel-auth-changed", handler);
    return () => window.removeEventListener("vidintel-auth-changed", handler);
  }, []);

  useEffect(() => {
    async function fetchUsage() {
      const { getToken } = await import("@/lib/auth");
      const token = getToken();
      if (!token) return;
      try { setUsage(await getUsage(token)); } catch { /* ignore */ }
    }
    if (user) fetchUsage();
  }, [user]);

  function handleSignOut() {
    logout();
    setUser(null);
    router.push("/login");
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "";

  const tabs = [
    { label: "Process", href: "/" },
    { label: "Sessions", href: "/history" },
    { label: "Docs", href: "#" },
  ];

  return (
    <nav
      style={{
        background: "var(--vi-bg)",
        borderBottom: "1px solid var(--vi-border)",
        color: "var(--vi-fg)",
      }}
      className="px-6 h-[52px] flex items-center justify-between gap-4 sticky top-0 z-20"
    >
      {/* Left: logo + version */}
      <Link href="/" className="flex items-center gap-3 shrink-0" style={{ textDecoration: "none", color: "var(--vi-fg)" }}>
        <span
          style={{
            border: "2px solid var(--vi-fg)",
            borderRadius: 6,
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          ▶
        </span>
        <span style={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.01em" }}>
          VidIntel
        </span>
        <span style={{ fontSize: "0.6rem", color: "var(--vi-fg-muted)", letterSpacing: "0.05em", fontWeight: 500 }}>
          V0.4 · BETA
        </span>
      </Link>

      {/* Center: nav tabs */}
      <div className="flex items-center gap-1">
        {tabs.map((tab) => {
          const active =
            (tab.href === "/" && pathname === "/") ||
            (tab.href !== "/" && tab.href !== "#" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.label}
              href={tab.href}
              style={{
                fontSize: "0.82rem",
                fontWeight: active ? 600 : 500,
                padding: "0.35rem 1rem",
                borderRadius: 99,
                background: active ? "var(--vi-fg)" : "transparent",
                color: active ? "var(--vi-bg)" : "var(--vi-fg-muted)",
                transition: "all 0.15s",
                textDecoration: "none",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Right: usage + user avatar + tweaks */}
      <div className="flex items-center gap-3 shrink-0">
        {user && usage && (
          <span style={{
            fontSize: "0.72rem",
            color: "var(--vi-fg-muted)",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
          }}>
            {usage.jobs_this_hour} / {usage.limit_per_hour}{" "}
            <span style={{ opacity: 0.5, fontSize: "0.65rem" }}>/hr</span>
          </span>
        )}

        {user ? (
          <>
            <button
              onClick={handleSignOut}
              style={{
                fontSize: "0.7rem",
                color: "var(--vi-fg-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              title="Sign out"
            >
              Sign out
            </button>
            <div
              title={user.email}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--vi-fg)",
                color: "var(--vi-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                fontWeight: 700,
                cursor: "default",
              }}
            >
              {initials}
            </div>
          </>
        ) : (
          <Link
            href="/login"
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "var(--vi-accent)",
              textDecoration: "none",
            }}
          >
            Sign In
          </Link>
        )}

        <button
          onClick={onTweaksClick}
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            color: "var(--vi-fg-muted)",
            background: "none",
            border: "1px solid var(--vi-border)",
            borderRadius: 4,
            padding: "0.25rem 0.6rem",
            cursor: "pointer",
            letterSpacing: "0.03em",
            display: "inline-flex",
          }}
        >
          ⚙
        </button>
      </div>
    </nav>
  );
}

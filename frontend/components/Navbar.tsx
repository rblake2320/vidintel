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
      try {
        const data = await getUsage(token);
        setUsage(data);
      } catch {
        // ignore
      }
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
  ];

  return (
    <nav
      style={{
        background: "var(--vi-bg-card)",
        borderBottom: "1px solid var(--vi-border)",
        color: "var(--vi-fg)",
      }}
      className="px-5 h-[52px] flex items-center justify-between gap-4 sticky top-0 z-20"
    >
      {/* Left: logo + version */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <span
          style={{
            background: "var(--vi-fg)",
            color: "var(--vi-bg)",
            borderRadius: 4,
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
          }}
        >
          ▶
        </span>
        <span style={{ fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.01em" }}>
          VidIntel
        </span>
        <span
          style={{
            fontSize: "0.6rem",
            color: "var(--vi-fg-muted)",
            letterSpacing: "0.05em",
          }}
        >
          v0.4 · BETA
        </span>
      </Link>

      {/* Center: nav tabs */}
      <div className="flex items-center gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                fontSize: "0.8rem",
                fontWeight: active ? 700 : 500,
                padding: "0.3rem 0.9rem",
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
        <Link
          href="/bulk"
          style={{
            fontSize: "0.8rem",
            fontWeight: pathname === "/bulk" ? 700 : 500,
            padding: "0.3rem 0.9rem",
            borderRadius: 99,
            background: pathname === "/bulk" ? "var(--vi-fg)" : "transparent",
            color: pathname === "/bulk" ? "var(--vi-bg)" : "var(--vi-fg-muted)",
            transition: "all 0.15s",
            textDecoration: "none",
          }}
        >
          Bulk
        </Link>
      </div>

      {/* Right: usage + user + tweaks */}
      <div className="flex items-center gap-3 shrink-0">
        {user && usage && (
          <span style={{ fontSize: "0.7rem", color: "var(--vi-fg-muted)", fontVariantNumeric: "tabular-nums" }}>
            {usage.jobs_this_hour} / {usage.limit_per_hour}{" "}
            <span style={{ opacity: 0.6 }}>/hr</span>
          </span>
        )}

        {user ? (
          <>
            <button
              onClick={handleSignOut}
              style={{ fontSize: "0.72rem", color: "var(--vi-fg-muted)", background: "none", border: "none", cursor: "pointer" }}
              title="Sign out"
            >
              Sign out
            </button>
            <div
              title={user.email}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--vi-accent)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.65rem",
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
            style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--vi-accent)", textDecoration: "none" }}
          >
            Sign In
          </Link>
        )}

        {/* Tweaks button */}
        <button
          onClick={onTweaksClick}
          style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            color: "var(--vi-fg-muted)",
            background: "var(--vi-input-bg)",
            border: "1px solid var(--vi-border)",
            borderRadius: 4,
            padding: "0.25rem 0.6rem",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
          title="Open tweaks panel"
        >
          Tweaks
        </button>
      </div>
    </nav>
  );
}

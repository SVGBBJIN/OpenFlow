"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Toasts } from "./Toasts";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦", ready: true },
  { href: "/rounds", label: "My Rounds", icon: "≡", ready: true },
  { href: "/evidence", label: "Evidence Library", icon: "❝", ready: false },
  { href: "/blocks", label: "Blocks", icon: "▤", ready: false },
  { href: "/documents", label: "Speech Documents", icon: "✎", ready: false },
  { href: "/shared", label: "Shared With Me", icon: "⇄", ready: false },
  { href: "/settings", label: "Settings", icon: "⚙", ready: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const init = useStore((s) => s.init);
  useEffect(() => {
    void init();
    try { document.documentElement.classList.toggle("compact", localStorage.getItem("openflow:density") === "compact"); } catch {}
  }, [init]);
  const inEditor = /^\/rounds\/[^/]+/.test(path) && path !== "/rounds/new";
  const compact = inEditor;

  return (
    <div className="flex h-full">
      <nav className={`flex shrink-0 flex-col border-r border-line bg-panel ${compact ? "w-12" : "w-52"}`} aria-label="Main">
        <Link href="/" className="flex h-11 items-center gap-2 border-b border-line px-3 font-semibold tracking-tight" title="OpenFlow">
          <span className="text-accent">◈</span>
          {!compact && <span>OpenFlow</span>}
        </Link>
        <ul className="flex-1 py-2">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  title={n.label}
                  className={`flex items-center gap-2 px-3 py-1.5 text-[13px] ${active ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}
                >
                  <span className="w-5 text-center">{n.icon}</span>
                  {!compact && (
                    <>
                      <span className="flex-1">{n.label}</span>
                      {!n.ready && <span className="chip">soon</span>}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        {!compact && <p className="border-t border-line p-3 text-[11px] leading-snug text-muted">Public Forum only. No AI — every argument and decision is yours.</p>}
      </nav>
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      <Toasts />
    </div>
  );
}

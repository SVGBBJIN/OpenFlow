"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useLib } from "@/lib/lib-store";
import { PresenceBar } from "./PresenceBar";

export type RoundTab = "flow" | "summary" | "final-focus" | "tracker" | "import" | "review" | "share";
const TABS: { id: RoundTab; label: string; href: (id: string) => string }[] = [
  { id: "flow", label: "Flow", href: (id) => `/rounds/${id}` },
  { id: "summary", label: "Summary", href: (id) => `/rounds/${id}/summary` },
  { id: "final-focus", label: "Final Focus", href: (id) => `/rounds/${id}/final-focus` },
  { id: "tracker", label: "Tracker", href: (id) => `/rounds/${id}/tracker` },
  { id: "import", label: "Import speech", href: (id) => `/rounds/${id}/import` },
  { id: "review", label: "Review", href: (id) => `/rounds/${id}/review` },
  { id: "share", label: "Share", href: (id) => `/rounds/${id}/share` },
];

export function RoundTabs({ roundId, active }: { roundId: string; active: RoundTab }) {
  return (
    <div className="flex gap-0.5" role="tablist" aria-label="Round views">
      {TABS.map((t) => (
        <Link key={t.id} href={t.href(roundId)} role="tab" aria-selected={active === t.id} className={`rounded px-2.5 py-1 text-[12px] ${active === t.id ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}>{t.label}</Link>
      ))}
    </div>
  );
}

/** Shared frame for round sub-pages; loads the round's flow data into the store. */
export function RoundShell({ roundId, active, children, actions }: { roundId: string; active: RoundTab; children: React.ReactNode; actions?: React.ReactNode }) {
  const ready = useStore((s) => s.ready);
  const round = useStore((s) => s.rounds[roundId]);
  const currentId = useStore((s) => s.currentId);
  const saveState = useStore((s) => s.saveState);
  useEffect(() => { if (ready && round) void useStore.getState().openRound(roundId); }, [ready, round, roundId]);
  useEffect(() => { void useLib.getState().load(); }, []);
  if (!ready) return <p className="p-6 text-muted">Loading…</p>;
  if (!round) return <p className="p-6 text-muted">Round not found.</p>;
  return (
    <div className="flex h-full flex-col">
      <header className="no-print flex h-11 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
        <span className="max-w-64 truncate text-[14px] font-medium">{round.title}</span>
        <RoundTabs roundId={roundId} active={active} />
        <div className="ml-auto flex items-center gap-2"><PresenceBar />{actions}<span className="text-[11px] text-muted">{saveState === "saving" ? "Saving…" : "Saved"}</span></div>
      </header>
      <div className="min-h-0 flex-1">{currentId === roundId ? children : <p className="p-6 text-muted">Opening round…</p>}</div>
    </div>
  );
}

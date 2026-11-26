"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import type { Round } from "@/lib/types";

export function ago(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function RoundRow({ r, actions = true }: { r: Round; actions?: boolean }) {
  const trash = useStore((s) => s.trashRound);
  return (
    <div className="flex items-center gap-3 border-b border-line px-3 py-2 hover:bg-raised">
      <span className={`chip ${r.side === "pro" ? "text-pro" : "text-con"}`}>{r.side.toUpperCase()}</span>
      <Link href={`/rounds/${r.id}`} className="min-w-0 flex-1">
        <div className="truncate text-[14px]">{r.title}</div>
        <div className="truncate text-[12px] text-muted">
          {[r.tournament, r.opponent && `vs ${r.opponent}`, r.partner && `with ${r.partner}`].filter(Boolean).join(" · ") || "No details"}
        </div>
      </Link>
      <span className="text-[12px] text-muted">{ago(r.updatedAt)}</span>
      <Link href={`/rounds/${r.id}`} className="btn">Resume</Link>
      {actions && (
        <button className="btn btn-ghost" onClick={() => trash(r.id)} title="Move to trash (undo available)">Delete</button>
      )}
    </div>
  );
}

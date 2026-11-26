"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { RoundRow, ago } from "@/components/RoundList";

export default function MyRounds() {
  const { rounds, restoreRound, purgeRound } = useStore();
  const [showTrash, setShowTrash] = useState(false);
  const all = Object.values(rounds).sort((a, b) => b.updatedAt - a.updatedAt);
  const live = all.filter((r) => !r.deletedAt);
  const trash = all.filter((r) => r.deletedAt);
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">My Rounds</h1>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setShowTrash(!showTrash)}>{showTrash ? "Hide" : "Show"} trash ({trash.length})</button>
            <Link href="/rounds/new" className="btn btn-primary">New round</Link>
          </div>
        </div>
        <div className="rounded-md border border-line bg-panel">
          {live.length === 0 && <p className="p-4 text-muted">No rounds.</p>}
          {live.map((r) => <RoundRow key={r.id} r={r} />)}
        </div>
        {showTrash && (
          <>
            <h2 className="label mb-2 mt-6">Trash</h2>
            <div className="rounded-md border border-line bg-panel">
              {trash.length === 0 && <p className="p-4 text-muted">Trash is empty.</p>}
              {trash.map((r) => (
                <div key={r.id} className="flex items-center gap-3 border-b border-line px-3 py-2">
                  <span className="flex-1 truncate">{r.title}</span>
                  <span className="text-[12px] text-muted">deleted {ago(r.deletedAt!)}</span>
                  <button className="btn" onClick={() => restoreRound(r.id)}>Restore</button>
                  <button className="btn btn-ghost text-bad" onClick={() => { if (confirm(`Permanently delete “${r.title}” and its whole flow? This cannot be undone.`)) purgeRound(r.id); }}>Delete forever</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

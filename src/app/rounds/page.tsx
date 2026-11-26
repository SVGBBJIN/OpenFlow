"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { RoundRow, ago } from "@/components/RoundList";
import { fromBundle } from "@/lib/round-export";
import { saveArgs } from "@/lib/storage";

export default function MyRounds() {
  const { rounds, restoreRound, purgeRound } = useStore();
  const [showTrash, setShowTrash] = useState(false);
  const [err, setErr] = useState("");
  async function importFile(f: File) {
    try {
      const { round, args } = fromBundle(JSON.parse(await f.text()));
      await saveArgs(round.id, args);
      await useStore.getState().importRound(round, args);
      useStore.getState().toast(`Imported “${round.title}”`);
      setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Import failed"); }
  }
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
            <label className="btn cursor-pointer">Import round (.json)<input type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} /></label>
            <Link href="/rounds/new" className="btn btn-primary">New round</Link>
          </div>
        </div>
        {err && <p className="mb-2 text-[13px] text-bad">{err}</p>}
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

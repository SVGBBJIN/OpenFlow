"use client";
import { useCollab } from "@/lib/collab/session";
import { useStore } from "@/lib/store";

export function PresenceBar() {
  const { config, status, peers } = useCollab();
  const readOnly = useStore((s) => s.readOnly);
  if (!config) return null;
  return (
    <div className="flex items-center gap-2" aria-label="Collaboration presence">
      <span className={`chip ${status === "live" ? "text-ok" : "text-warn"}`}>{status === "live" ? "● live" : "connecting…"}</span>
      {readOnly && <span className="chip text-warn" title="Viewers can follow along but not edit">view only</span>}
      <div className="flex -space-x-1.5">
        {peers.map((p) => (
          <span key={p.clientId} title={`${p.name}${p.self ? " (you)" : ""}${p.editingId ? " — editing" : ""}`} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-panel text-[10px] font-bold text-bg" style={{ background: p.color }}>
            {p.name.replace(/^Debater\s*/, "").slice(0, 2).toUpperCase() || "?"}
          </span>
        ))}
      </div>
    </div>
  );
}

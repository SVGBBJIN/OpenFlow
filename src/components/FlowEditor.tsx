"use client";
import { useEffect, useState } from "react";
import { actionFor, prettyCombo, type ActionId } from "@/lib/keymap";
import { useStore } from "@/lib/store";
import type { Status } from "@/lib/types";
import { FlowGrid } from "./FlowGrid";
import { Inspector } from "./Inspector";
import { Palette } from "./Palette";

const STATUS_ACTIONS: Partial<Record<ActionId, Status>> = {
  statusActive: "active", statusAnswered: "answered", statusDropped: "dropped",
  statusExtended: "extended", statusTurned: "turned", statusUnresolved: "unresolved",
};

export function FlowEditor({ roundId }: { roundId: string }) {
  const ready = useStore((s) => s.ready);
  const round = useStore((s) => s.rounds[roundId]);
  const currentId = useStore((s) => s.currentId);
  const flow = useStore((s) => s.flow);
  const args = useStore((s) => s.args);
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const saveState = useStore((s) => s.saveState);
  const pick = useStore((s) => s.pick);
  const editing = useStore((s) => s.editingId);
  const keymap = useStore((s) => s.keymap);
  const [panel, setPanel] = useState(true);

  useEffect(() => { if (ready && round) void useStore.getState().openRound(roundId); }, [ready, round, roundId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      if (st.editingId || st.paletteOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const r = st.rounds[st.currentId ?? ""]; if (!r) return;

      if (st.pick) {
        if (e.key === "Escape") { e.preventDefault(); st.setPick(null); return; }
        if (e.key === "Enter" && st.selectedId) { e.preventDefault(); st.confirmPick(st.selectedId); return; }
      }
      const a = actionFor(e, st.keymap);
      if (!a) {
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && st.selectedId && st.args[st.selectedId] && !st.pick) {
          e.preventDefault(); st.beginEdit(st.selectedId, e.key);
        }
        return;
      }
      const sel = st.selectedId;
      const run = (fn: () => void) => { e.preventDefault(); fn(); };
      switch (a) {
        case "newArgument": return run(() => st.newSibling());
        case "newResponse": return run(() => st.newResponse());
        case "newContention": return run(() => st.newContention());
        case "next": return run(() => st.step(1, false));
        case "prev": return run(() => st.step(-1, false));
        case "up": case "down": case "left": case "right": return run(() => st.navigateDir(a));
        case "startEdit": return run(() => sel && st.beginEdit(sel));
        case "palette": return run(() => st.setPalette(true));
        case "undo": return run(() => st.undo());
        case "redo": return run(() => st.redo());
        case "deleteArg": return run(() => st.deleteSelected());
        case "toggleCollapse": return run(() => st.toggleCollapse());
        case "moveUp": return run(() => st.move(-1));
        case "moveDown": return run(() => st.move(1));
        case "colLeft": return run(() => st.shiftColumn(-1));
        case "colRight": return run(() => st.shiftColumn(1));
        case "extend": return run(() => st.newResponse({ extend: true }));
        case "turn": return run(() => st.newResponse({ isTurn: true }));
        case "switchFlow": return run(() => st.setFlow(st.flow === "pro" ? "con" : "pro"));
        case "exitEdit": return run(() => st.select(st.selectedId));
        default: { const s = STATUS_ACTIONS[a]; if (s && sel) run(() => st.setStatus(sel, s)); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!ready) return <p className="p-6 text-muted">Loading…</p>;
  if (!round) return <p className="p-6 text-muted">Round not found.</p>;
  if (currentId !== roundId) return <p className="p-6 text-muted">Opening round…</p>;

  const counts = (f: "pro" | "con") => Object.values(args).filter((a) => a.flow === f).length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
        <span className="max-w-64 truncate text-[14px] font-medium">{round.title}</span>
        <div className="flex rounded-md border border-line2 p-0.5" role="tablist">
          {(["pro", "con"] as const).map((f) => (
            <button key={f} role="tab" aria-selected={flow === f} onClick={() => useStore.getState().setFlow(f)}
              className={`rounded px-3 py-0.5 text-[12px] ${flow === f ? "bg-raised text-fg" : "text-muted"}`}
              style={flow === f ? { color: f === "pro" ? "var(--color-pro)" : "var(--color-con)" } : undefined}>
              {f === "pro" ? "Pro" : "Con"} flow <span className="text-muted">{counts(f)}</span>
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted">{round.side === "pro" ? "You: Pro" : "You: Con"}</span>
        <div className="ml-auto flex items-center gap-1">
          <button className="btn btn-ghost" disabled={!past} onClick={() => useStore.getState().undo()} title={`Undo (${prettyCombo(keymap.undo)})`}>↶</button>
          <button className="btn btn-ghost" disabled={!future} onClick={() => useStore.getState().redo()} title={`Redo (${prettyCombo(keymap.redo)})`}>↷</button>
          <button className="btn btn-ghost" onClick={() => useStore.getState().setPalette(true)} title="Command palette">/ commands</button>
          <span className={`w-16 text-right text-[11px] ${saveState === "error" ? "text-bad" : "text-muted"}`} aria-live="polite">{saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved"}</span>
          <button className="btn btn-ghost" onClick={() => setPanel(!panel)} title="Toggle side panel">{panel ? "⟩" : "⟨"}</button>
        </div>
      </header>
      {pick && (
        <div className="border-b border-warn/40 bg-warn/10 px-3 py-1 text-[12px] text-warn">
          {pick.kind === "link" ? "Linking" : "Moving"}: click the target argument (or navigate and press Enter). Esc cancels.
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1"><FlowGrid round={round} /></div>
        {panel && <Inspector round={round} />}
      </div>
      <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-panel px-3 text-[11px] text-muted">
        {editing ? (
          <>
            <span><span className="kbd">Enter</span> new argument</span>
            <span><span className="kbd">⇧Enter</span> response</span>
            <span><span className="kbd">Tab</span> next</span>
            <span><span className="kbd">Esc</span> done</span>
            <span><span className="kbd">/</span> commands (at start)</span>
          </>
        ) : (
          <>
            <span><span className="kbd">Enter</span> new</span>
            <span><span className="kbd">⇧Enter</span> response</span>
            <span><span className="kbd">←↑↓→</span> move</span>
            <span><span className="kbd">Tab</span> next</span>
            <span><span className="kbd">F2</span> / type to edit</span>
            <span><span className="kbd">Alt+1–6</span> status</span>
            <span><span className="kbd">/</span> commands</span>
            <span><span className="kbd">Del</span> delete (undoable)</span>
          </>
        )}
      </footer>
      <Palette />
    </div>
  );
}

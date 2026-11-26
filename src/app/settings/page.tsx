"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { ACTION_LABELS, DEFAULT_KEYMAP, comboFromEvent, prettyCombo, type ActionId } from "@/lib/keymap";

export default function Settings() {
  const keymap = useStore((s) => s.keymap);
  const setKeymap = useStore((s) => s.setKeymap);
  const [rec, setRec] = useState<ActionId | null>(null);
  const [compact, setCompact] = useState(() => { try { return typeof localStorage !== "undefined" && localStorage.getItem("openflow:density") === "compact"; } catch { return false; } });

  useEffect(() => {
    if (!rec) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === "Escape") return setRec(null);
      const c = comboFromEvent(e);
      if (!c) return;
      setKeymap({ ...keymap, [rec]: c });
      setRec(null);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [rec, keymap, setKeymap]);

  const conflicts = (a: ActionId) => (Object.keys(keymap) as ActionId[]).filter((b) => b !== a && keymap[b] === keymap[a]);
  const toggleDensity = (v: boolean) => {
    setCompact(v);
    try { localStorage.setItem("openflow:density", v ? "compact" : "comfortable"); } catch {}
    document.documentElement.classList.toggle("compact", v);
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-xl font-semibold">Settings</h1>
        <h2 className="label mb-2">Flow density</h2>
        <label className="mb-6 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={compact} onChange={(e) => toggleDensity(e.target.checked)} /> Compact columns (more speeches on screen)</label>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="label">Keyboard shortcuts</h2>
          <button className="btn btn-ghost" onClick={() => setKeymap(DEFAULT_KEYMAP)}>Reset all</button>
        </div>
        <p className="mb-3 text-[12px] text-muted">Click a shortcut, then press the new combination (Esc cancels). Letter shortcuts are matched by physical key so Option/Alt combos work on Mac. Plain text editing keys are never captured while typing.</p>
        <div className="rounded-md border border-line bg-panel">
          {(Object.keys(ACTION_LABELS) as ActionId[]).map((a) => (
            <div key={a} className="flex items-center gap-3 border-b border-line px-3 py-1.5">
              <span className="flex-1 text-[13px]">{ACTION_LABELS[a]}</span>
              {conflicts(a).length > 0 && <span className="text-[11px] text-warn">conflicts with {conflicts(a).map((c) => ACTION_LABELS[c]).join(", ")}</span>}
              <button className="kbd min-w-16 text-center" onClick={() => setRec(a)}>{rec === a ? "press keys…" : prettyCombo(keymap[a])}</button>
              {keymap[a] !== DEFAULT_KEYMAP[a] && <button className="text-[11px] text-muted hover:text-fg" onClick={() => setKeymap({ ...keymap, [a]: DEFAULT_KEYMAP[a] })}>reset</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

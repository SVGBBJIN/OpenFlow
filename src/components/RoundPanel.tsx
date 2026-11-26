"use client";
import { newId } from "@/lib/flow-ops";
import { useStore } from "@/lib/store";
import type { Round, Side, Speech } from "@/lib/types";

export function RoundPanel({ round }: { round: Round }) {
  const update = useStore((s) => s.updateRound);
  const args = useStore((s) => s.args);
  const toast = useStore((s) => s.toast);
  const count = (sid: string) => Object.values(args).filter((a) => a.speechId === sid).length;
  const setSpeeches = (speeches: Speech[]) => update(round.id, { speeches });
  const patchSpeech = (id: string, p: Partial<Speech>) => setSpeeches(round.speeches.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= round.speeches.length) return;
    const l = [...round.speeches]; [l[i], l[j]] = [l[j], l[i]]; setSpeeches(l);
  };
  const stop = (e: React.KeyboardEvent) => { e.stopPropagation(); if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLElement).blur(); };

  return (
    <div className="space-y-3 text-[13px]">
      {(["title", "tournament", "opponent", "partner"] as const).map((k) => (
        <label key={k} className="block"><span className="label">{k}</span>
          <input className="input mt-1" defaultValue={round[k]} onKeyDown={stop} onBlur={(e) => e.target.value !== round[k] && update(round.id, { [k]: e.target.value })} />
        </label>
      ))}
      <div><span className="label">Your side</span>
        <div className="mt-1 flex gap-1">{(["pro", "con"] as Side[]).map((s) => <button key={s} className={`btn ${round.side === s ? "btn-primary" : ""}`} onClick={() => update(round.id, { side: s })}>{s}</button>)}</div>
      </div>
      <div>
        <div className="label mb-1">Speech columns</div>
        {round.speeches.map((s, i) => (
          <div key={s.id} className="mb-1 flex items-center gap-1">
            <input className="input" defaultValue={s.name} onKeyDown={stop} onBlur={(e) => e.target.value.trim() && patchSpeech(s.id, { name: e.target.value.trim() })} />
            <input className="input w-12" type="number" min={1} defaultValue={s.minutes} onKeyDown={stop} onBlur={(e) => patchSpeech(s.id, { minutes: Math.max(1, +e.target.value || s.minutes) })} title="Minutes" />
            <button className="btn btn-ghost px-1" onClick={() => swap(i, i - 1)} title="Move left">←</button>
            <button className="btn btn-ghost px-1" onClick={() => swap(i, i + 1)} title="Move right">→</button>
            <button className="btn btn-ghost px-1 text-bad" title="Remove column"
              onClick={() => {
                if (round.speeches.length <= 1) return toast("A round needs at least one speech");
                if (count(s.id)) return toast(`“${s.name}” still has ${count(s.id)} argument(s). Move them first.`);
                setSpeeches(round.speeches.filter((x) => x.id !== s.id));
              }}>×</button>
          </div>
        ))}
        <div className="mt-2 flex gap-1">
          {(["pro", "con"] as Side[]).map((side) => (
            <button key={side} className="btn text-[12px]" onClick={() => setSpeeches([...round.speeches, { id: newId(), name: `${side === "pro" ? "Pro" : "Con"} Speech`, side, minutes: 2 }])}>+ {side} column</button>
          ))}
        </div>
      </div>
    </div>
  );
}

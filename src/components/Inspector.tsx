"use client";
import { useState } from "react";
import { htmlToText } from "@/lib/sanitize";
import { useStore } from "@/lib/store";
import { STATUSES, type Round } from "@/lib/types";
import { RoundPanel } from "./RoundPanel";
import { InsertsPanel } from "./InsertsPanel";

export function Inspector({ round }: { round: Round }) {
  const [tab, setTab] = useState<"arg" | "round">("arg");
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-line bg-panel">
      <div className="flex border-b border-line text-[12px]">
        {(["arg", "round"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 ${tab === t ? "border-b-2 border-accent text-fg" : "text-muted"}`}>{t === "arg" ? "Argument" : "Round & speeches"}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3">{tab === "arg" ? <ArgPanel round={round} /> : <RoundPanel round={round} />}</div>
    </aside>
  );
}

function ArgPanel({ round }: { round: Round }) {
  const id = useStore((s) => s.selectedId);
  const a = useStore((s) => (id ? s.args[id] : null));
  const args = useStore((s) => s.args);
  const { patchArg, setStatus, setPick, newResponse, deleteSelected, select } = useStore.getState();
  const [tag, setTag] = useState("");
  if (!a) return <p className="text-[13px] text-muted">Select an argument to see its status, tags, notes and links.</p>;
  const speech = round.speeches.find((s) => s.id === a.speechId);
  const parent = a.parentId ? args[a.parentId] : null;
  const kids = Object.values(args).filter((x) => x.parentId === a.id);

  return (
    <div className="space-y-4" key={a.id}>
      <div>
        <div className="label">{speech?.name} · {a.flow} flow</div>
        <p className="mt-1 line-clamp-3 text-[13px]">{htmlToText(a.text) || <span className="text-muted">empty</span>}</p>
        {parent && <button className="mt-1 text-[11px] text-accent hover:underline" onClick={() => select(parent.id)}>↑ responds to: {htmlToText(parent.text).slice(0, 40) || "…"}</button>}
        {a.extendsId && <p className="text-[11px] text-[#4fc3d9]">Extends an earlier argument</p>}
        <p className="text-[11px] text-muted">{kids.length} direct response{kids.length === 1 ? "" : "s"}</p>
      </div>
      <div>
        <div className="label mb-1">Status (you decide)</div>
        <div className="grid grid-cols-3 gap-1">
          {STATUSES.map((s, n) => (
            <button key={s} title={`Alt+${n + 1}`} onClick={() => setStatus(a.id, s)} className={`btn justify-center px-1 py-1 text-[12px] ${a.status === s ? "btn-primary" : ""}`}>{s}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="label mb-1">Priority</div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((p) => <button key={p} onClick={() => patchArg(a.id, { priority: p as 0 | 1 | 2 | 3 })} className={`btn px-2 py-1 text-[12px] ${a.priority === p ? "btn-primary" : ""}`}>{p || "–"}</button>)}
        </div>
      </div>
      <div>
        <div className="label mb-1">Tags</div>
        <div className="mb-1 flex flex-wrap gap-1">
          {a.tags.map((t) => <button key={t} className="chip hover:text-bad" title="Remove" onClick={() => patchArg(a.id, { tags: a.tags.filter((x) => x !== t) })}>#{t} ×</button>)}
        </div>
        <input className="input" placeholder="add tag, Enter" value={tag} onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && tag.trim()) { patchArg(a.id, { tags: [...new Set([...a.tags, tag.trim().replace(/^#/, "")])] }); setTag(""); } if (e.key === "Escape") (e.target as HTMLElement).blur(); }} />
      </div>
      <InsertsPanel argId={a.id} />
      <Area label="Impact comparison" value={a.impact} onSave={(v) => patchArg(a.id, { impact: v })} placeholder="How does this impact compare to the other side's?" />
      <Area label="Notes" value={a.notes} onSave={(v) => patchArg(a.id, { notes: v })} placeholder="Private notes on this argument" />
      <div>
        <div className="label mb-1">Links to other arguments</div>
        {a.linkedIds.map((l) => args[l] && (
          <div key={l} className="flex items-center gap-2 text-[12px]">
            <button className="min-w-0 flex-1 truncate text-left text-accent hover:underline" onClick={() => select(l)}>{htmlToText(args[l].text).slice(0, 40) || "…"}</button>
            <button className="text-muted hover:text-bad" title="Remove link" onClick={() => useStore.getState().unlink(a.id, l)}>×</button>
          </div>
        ))}
        <button className="btn mt-1 text-[12px]" onClick={() => setPick({ kind: "link", from: a.id })}>Link…</button>
      </div>
      <div className="flex flex-wrap gap-1 border-t border-line pt-3">
        <button className="btn text-[12px]" onClick={() => newResponse()}>+ Response</button>
        <button className="btn text-[12px]" onClick={() => newResponse({ isTurn: true })}>+ Turn</button>
        <button className="btn text-[12px]" onClick={() => newResponse({ extend: true })}>Extend</button>
        <button className="btn text-[12px]" onClick={() => setPick({ kind: "reparent", from: a.id })}>Move under…</button>
        <button className="btn text-[12px] text-bad" onClick={() => deleteSelected()}>Delete</button>
      </div>
    </div>
  );
}

function Area({ label, value, onSave, placeholder }: { label: string; value: string; onSave(v: string): void; placeholder: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className="input mt-1 min-h-16 resize-y" defaultValue={value} placeholder={placeholder}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") (e.target as HTMLElement).blur(); }}
        onBlur={(e) => e.target.value !== value && onSave(e.target.value)} />
    </label>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { docxBlob, download, safeName } from "@/lib/export-docx";
import { layoutFlow } from "@/lib/layout";
import { blankBlock, slugBlockName, type BlockEntry } from "@/lib/library";
import { useLib } from "@/lib/lib-store";
import { newId } from "@/lib/flow-ops";
import { htmlToText } from "@/lib/sanitize";
import { roundToNodes, toBundle } from "@/lib/round-export";
import { useStore } from "@/lib/store";
import { deleteVersion, diffSummary, listVersions, saveVersion, type Version } from "@/lib/versions";
import { STATUSES, emptyReview, type Arg, type Review, type Round } from "@/lib/types";
import { Html } from "../RichText";

const stop = (e: React.KeyboardEvent) => { e.stopPropagation(); if (e.key === "Escape") (e.target as HTMLElement).blur(); };
const ago = (t: number) => new Date(t).toLocaleString();

export function ReviewView({ round }: { round: Round }) {
  const args = useStore((s) => s.args);
  const review = round.review ?? emptyReview();
  const [versions, setVersions] = useState<Version[]>([]);
  const [label, setLabel] = useState("");
  const [tick, setTick] = useState(0);
  const colOf = (sid: string) => round.speeches.findIndex((s) => s.id === sid);
  const setReview = (p: Partial<Review>) => useStore.getState().updateRound(round.id, { review: { ...review, ...p } });
  useEffect(() => { let on = true; void listVersions(round.id).then((v) => on && setVersions(v)); return () => { on = false; }; }, [round.id, tick]);

  const ordered = useMemo(() => {
    const out: { a: Arg; depth: number }[] = [];
    for (const f of ["pro", "con"] as const) for (const id of layoutFlow(args, f, colOf).order) { let d = 0, c = args[id]; while (c?.parentId && args[c.parentId]) { d++; c = args[c.parentId]; } out.push({ a: args[id], depth: d }); }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args, round.speeches]);
  const sName = (id: string) => round.speeches.find((s) => s.id === id)?.name ?? "?";
  const rootOf = (a: Arg) => { let c = a; while (c.parentId && args[c.parentId]) c = args[c.parentId]; return c; };
  const roots = ordered.filter(({ a }) => !a.parentId).map(({ a }) => a);
  const dropped = ordered.filter(({ a }) => a.status === "dropped");
  const extensions = Object.values(args).filter((a) => a.extendsId);

  const makeBlock = (a: Arg) => {
    const lib = useLib.getState();
    const entries: BlockEntry[] = [{ id: newId(), type: "text", cardId: null, html: a.text }];
    for (const ins of a.inserts) for (const e of ins.entries) {
      if (e.kind === "text") { entries.push({ id: newId(), type: "text", cardId: null, html: e.html }); continue; }
      let cid = e.cardId && lib.cards[e.cardId] ? e.cardId : null;
      if (!cid) cid = lib.addCard({ tag: e.tag, citation: e.citation, bodyHtml: e.html, notes: "Recovered from a round review" });
      entries.push({ id: newId(), type: "card", cardId: cid, html: "" });
    }
    const base = slugBlockName(htmlToText(a.text).slice(0, 28));
    let name = base, n = 2;
    while (Object.values(lib.blocks).some((b) => b.name === name)) name = `${base}-${n++}`;
    lib.addBlock(blankBlock({ name, kind: a.parentId ? "frontline" : "constructive", topic: round.title, entries }));
    useStore.getState().toast(`Block /${name} created in the Block Library`);
  };
  const doExport = async (kind: "json" | "docx") => {
    if (kind === "json") download(new Blob([JSON.stringify(toBundle(round, args), null, 2)], { type: "application/json" }), `${safeName(round.title)}.openflow.json`);
    else download(await docxBlob(roundToNodes(round, args)), `${safeName(round.title)}.docx`);
  };
  const T = ({ k, label: l, rows = 3 }: { k: keyof Omit<Review, "argNotes" | "result">; label: string; rows?: number }) => (
    <label className="block"><span className="label">{l}</span><textarea className="input mt-1" rows={rows} defaultValue={review[k]} onKeyDown={stop} onBlur={(e) => e.target.value !== review[k] && setReview({ [k]: e.target.value })} /></label>
  );

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="no-print rounded-md border border-line bg-panel p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold">Round review</h1>
            <label className="flex items-center gap-1 text-[13px]"><input type="checkbox" checked={!!round.completed} onChange={(e) => useStore.getState().updateRound(round.id, { completed: e.target.checked })} /> Mark round completed</label>
            <div className="flex items-center gap-1 text-[13px]"><span className="text-muted">Result (you enter it):</span>
              {(["", "win", "loss"] as const).map((r) => <button key={r || "none"} className={`btn px-2 py-0.5 ${review.result === r ? "btn-primary" : ""}`} onClick={() => setReview({ result: r })}>{r || "—"}</button>)}</div>
            <div className="ml-auto flex gap-1"><button className="btn" onClick={() => void doExport("docx")}>Export DOCX</button><button className="btn" onClick={() => void doExport("json")}>Export JSON</button><button className="btn" onClick={() => window.print()}>Print / PDF</button></div>
          </div>
          <p className="mt-1 text-[12px] text-muted">OpenFlow never decides who won an argument or the round. Everything here is what you record.</p>
        </section>

        <section className="no-print grid gap-3 rounded-md border border-line bg-panel p-4 md:grid-cols-2">
          {T({ k: "judge", label: "Judge", rows: 1 })}{T({ k: "ballot", label: "Ballot / decision", rows: 1 })}
          <div className="md:col-span-2">{T({ k: "rfd", label: "Reason for decision (RFD)", rows: 4 })}</div>
          {T({ k: "judgeFeedback", label: "Judge feedback", rows: 4 })}{T({ k: "opponentStrategy", label: "Opponent strategy notes", rows: 4 })}
          <div className="md:col-span-2">{T({ k: "observations", label: "Personal observations", rows: 3 })}</div>
        </section>

        <section className="rounded-md border border-line bg-panel p-4">
          <h2 className="mb-2 text-[15px] font-medium">Contentions across speeches</h2>
          <p className="mb-2 text-[12px] text-muted">How many arguments sit under each contention in each speech (counted from the flow).</p>
          <div className="overflow-auto"><table className="w-full text-[12px]"><thead><tr><th className="p-1 text-left">Contention</th>{round.speeches.map((s) => <th key={s.id} className="p-1 text-center font-normal text-muted">{s.name.replace(" ", " ")}</th>)}</tr></thead>
            <tbody>{roots.map((r) => (
              <tr key={r.id} className="border-t border-line"><td className="max-w-56 truncate p-1"><span className={r.flow === "pro" ? "text-pro" : "text-con"}>{r.flow[0].toUpperCase()}</span> {htmlToText(r.text).slice(0, 40) || "(empty)"}</td>
                {round.speeches.map((s) => { const n = Object.values(args).filter((a) => a.speechId === s.id && rootOf(a).id === r.id).length; return <td key={s.id} className={`p-1 text-center ${n ? "bg-accent/15" : "text-muted"}`}>{n || "·"}</td>; })}</tr>))}
              {roots.length === 0 && <tr><td className="p-2 text-muted">No contentions yet.</td></tr>}</tbody></table></div>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div><div className="label mb-1">Dropped (as you marked) — {dropped.length}</div>{dropped.length === 0 ? <p className="text-[12px] text-muted">None marked.</p> : dropped.map(({ a }) => <p key={a.id} className="text-[12px]"><span className="chip mr-1">{sName(a.speechId)}</span>{htmlToText(a.text).slice(0, 80)}</p>)}</div>
            <div><div className="label mb-1">Extensions — {extensions.length}</div>{extensions.length === 0 ? <p className="text-[12px] text-muted">None recorded.</p> : extensions.map((a) => <p key={a.id} className="text-[12px]"><span className="chip mr-1">{sName(a.speechId)}</span>extends “{htmlToText(args[a.extendsId!]?.text ?? "").slice(0, 50)}”</p>)}</div>
          </div>
        </section>

        <section className="rounded-md border border-line bg-panel p-4">
          <h2 className="mb-2 text-[15px] font-medium">Argument-by-argument review</h2>
          {ordered.length === 0 && <p className="text-[13px] text-muted">The flow is empty.</p>}
          {ordered.map(({ a, depth }) => (
            <div key={a.id} className="flex items-start gap-2 border-t border-line py-1.5" style={{ paddingLeft: Math.min(depth, 4) * 14 }}>
              <span className={`chip mt-0.5 ${a.flow === "pro" ? "text-pro" : "text-con"}`}>{a.flow[0].toUpperCase()}</span>
              <div className="min-w-0 flex-1"><div className="flex items-start gap-2"><Html html={a.text} className="min-w-0 flex-1 text-[13px]" /><span className="shrink-0 text-[11px] text-muted">{sName(a.speechId)}</span></div>
                <input className="input mt-1 text-[12px]" key={a.id + (review.argNotes?.[a.id] ?? "")} defaultValue={review.argNotes?.[a.id] ?? ""} placeholder="Review note (what worked, what to change)…" onKeyDown={stop} onBlur={(e) => e.target.value !== (review.argNotes?.[a.id] ?? "") && setReview({ argNotes: { ...(review.argNotes ?? {}), [a.id]: e.target.value } })} /></div>
              <select className="input w-28 py-0.5 text-[12px]" value={a.status} onChange={(e) => useStore.getState().setStatus(a.id, e.target.value as Arg["status"])}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
              <button className="btn px-2 py-0.5 text-[11px]" title="Save this argument (with its evidence) as a reusable block" onClick={() => makeBlock(a)}>→ Block</button>
              <Link className="btn btn-ghost px-1.5 py-0.5 text-[11px]" href={`/rounds/${round.id}?sel=${a.id}`}>open</Link>
            </div>
          ))}
        </section>

        <section className="no-print rounded-md border border-line bg-panel p-4">
          <h2 className="mb-2 text-[15px] font-medium">Round history (versions)</h2>
          <div className="mb-3 flex gap-2"><input className="input max-w-xs" placeholder="Label, e.g. After Summary" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={stop} />
            <button className="btn" onClick={async () => { await saveVersion(round, args, label || "Manual save"); setLabel(""); setTick((t) => t + 1); useStore.getState().toast("Version saved"); }}>Save version now</button></div>
          {versions.length === 0 && <p className="text-[13px] text-muted">No versions yet. A snapshot is saved automatically at most every 10 minutes while you edit, and whenever you save one here.</p>}
          {versions.map((v) => { const d = diffSummary(v.args, args); return (
            <div key={v.id} className="flex items-center gap-2 border-t border-line py-1.5 text-[13px]">
              <span className="min-w-0 flex-1"><span className="font-medium">{v.label}</span> <span className="chip">{v.auto ? "auto" : "manual"}</span><div className="text-[11px] text-muted">{ago(v.at)} · {Object.keys(v.args).length} args · restoring adds {d.removed}, removes {d.added}, reverts {d.changed}</div></span>
              <button className="btn" onClick={() => { if (confirm(`Restore “${v.label}”? Your current flow is saved first, and Undo is available.`)) useStore.getState().restoreVersion(v); }}>Restore</button>
              <button className="btn btn-ghost text-bad" onClick={async () => { await deleteVersion(round.id, v.id); setTick((t) => t + 1); }}>Delete</button>
            </div>); })}
        </section>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { useDocs } from "@/lib/docs-store";
import { docxBlob, download, safeName, type ExportNode } from "@/lib/export-docx";
import { newId } from "@/lib/flow-ops";
import { searchCards } from "@/lib/library";
import { useLib } from "@/lib/lib-store";
import { addArgsToDoc, applySync, planSync, type DocEntry, type SpeechDoc, type SyncState } from "@/lib/prep";
import { htmlToText } from "@/lib/sanitize";
import { loadArgs } from "@/lib/storage";
import { useStore } from "@/lib/store";
import { normalizeArg } from "@/lib/store";
import type { ArgMap } from "@/lib/types";
import { Html, RichText } from "../RichText";

export function docToNodes(doc: SpeechDoc): ExportNode[] {
  const n: ExportNode[] = [{ type: "title", text: doc.title }];
  for (const e of doc.entries) {
    if (e.kind === "heading") n.push({ type: "heading", level: e.level, text: e.text });
    else if (e.kind === "text") n.push({ type: "html", html: e.html });
    else if (e.kind === "arg") n.push({ type: "html", html: e.content });
    else n.push({ type: "card", tag: e.tag, citation: e.citation, html: e.content });
  }
  return n;
}

const STATE_STYLE: Record<SyncState, string> = { unchanged: "text-muted", incoming: "text-ok", local: "text-accent", conflict: "text-warn", missing: "text-bad" };
const STATE_TEXT: Record<SyncState, string> = {
  unchanged: "in sync", incoming: "source changed — update available", local: "edited here only (kept)", conflict: "both changed — choose", missing: "source deleted",
};
const stop = (e: React.KeyboardEvent) => { e.stopPropagation(); if (e.key === "Escape") (e.target as HTMLElement).blur(); };

export function DocumentEditor({ docId }: { docId: string }) {
  const ready = useDocs((s) => s.ready);
  const doc = useDocs((s) => s.docs[docId]);
  const cards = useLib((s) => s.cards);
  const rounds = useStore((s) => s.rounds);
  const [args, setArgs] = useState<ArgMap>({});
  const [panel, setPanel] = useState<null | "cards" | "flow" | "sync">(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [cq, setCq] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [decisions, setDecisions] = useState<Record<string, "source" | "mine">>({});
  useEffect(() => { void useDocs.getState().load(); void useLib.getState().load(); void useStore.getState().init(); }, []);
  const roundId = doc?.roundId ?? null;
  useEffect(() => {
    if (!roundId) return;
    let live = true;
    void loadArgs(roundId).then((a) => { if (live) setArgs(Object.fromEntries(Object.entries(a).map(([k, v]) => [k, normalizeArg(v)]))); });
    return () => { live = false; };
  }, [roundId, panel]);

  const sync = useMemo(() => (doc ? planSync(doc, roundId ? args : {}, cards) : []), [doc, args, cards, roundId]);
  if (!ready) return <p className="p-6 text-muted">Loading…</p>;
  if (!doc) return <p className="p-6 text-muted">Document not found.</p>;

  const put = (d: SpeechDoc) => useDocs.getState().put(d);
  const setEntries = (entries: DocEntry[]) => put({ ...doc, entries });
  const patch = (id: string, p: Partial<DocEntry>) => setEntries(doc.entries.map((e) => (e.id === id ? ({ ...e, ...p } as DocEntry) : e)));
  const move = (from: string, to: string) => {
    const i = doc.entries.findIndex((e) => e.id === from), j = doc.entries.findIndex((e) => e.id === to);
    if (i < 0 || j < 0 || i === j) return;
    const l = [...doc.entries]; const [x] = l.splice(i, 1); l.splice(j, 0, x); setEntries(l);
  };
  const step = (id: string, d: number) => { const i = doc.entries.findIndex((e) => e.id === id); const j = i + d; if (j >= 0 && j < doc.entries.length) move(id, doc.entries[j].id); };
  const states = Object.fromEntries(sync.map((s) => [s.entryId, s]));
  const pending = sync.filter((s) => s.state === "incoming" || s.state === "conflict");
  const roundArgs = Object.values(args).sort((a, b) => a.createdAt - b.createdAt);
  const results = cq ? searchCards(Object.values(cards), cq).slice(0, 10) : [];

  const exportDocx = async () => download(await docxBlob(docToNodes(doc)), `${safeName(doc.title)}.docx`);

  return (
    <div className="flex h-full flex-col">
      <header className="no-print flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2">
        <input className="input max-w-sm text-[15px] font-medium" defaultValue={doc.title} onKeyDown={stop} onBlur={(e) => e.target.value !== doc.title && put({ ...doc, title: e.target.value || doc.title })} />
        <span className="chip">{doc.speechName || "speech"}</span>
        {roundId && rounds[roundId] && <span className="text-[12px] text-muted">linked to {rounds[roundId].title}</span>}
        <div className="ml-auto flex flex-wrap gap-1">
          <button className="btn" onClick={() => setEntries([...doc.entries, { id: newId(), kind: "heading", level: 2, text: "Heading" }])}>＋ Heading</button>
          <button className="btn" onClick={() => setEntries([...doc.entries, { id: newId(), kind: "text", html: "<p></p>" }])}>＋ Text</button>
          <button className="btn" onClick={() => setPanel(panel === "cards" ? null : "cards")}>＋ Evidence</button>
          <button className="btn" disabled={!roundId} title={roundId ? "" : "Link a round to pull arguments from its flow"} onClick={() => setPanel(panel === "flow" ? null : "flow")}>＋ From flow</button>
          <button className={`btn ${pending.length ? "btn-primary" : ""}`} onClick={() => { setPanel(panel === "sync" ? null : "sync"); setDecisions({}); }}>Sync{pending.length ? ` (${pending.length})` : ""}</button>
          <button className="btn" onClick={() => void exportDocx()}>DOCX</button>
          <button className="btn" title="Opens the print dialog — choose “Save as PDF”" onClick={() => window.print()}>PDF / Print</button>
        </div>
      </header>

      {panel && (
        <div className="no-print max-h-72 overflow-auto border-b border-line bg-raised p-3 text-[13px]">
          {panel === "cards" && (
            <div><input autoFocus className="input mb-2 max-w-md" placeholder="Search evidence…" value={cq} onChange={(e) => setCq(e.target.value)} onKeyDown={stop} />
              {results.map((c) => <button key={c.id} className="mb-1 block w-full rounded border border-line bg-panel px-2 py-1 text-left hover:border-accent" onClick={() => setEntries([...doc.entries, { id: newId(), kind: "card", cardId: c.id, tag: c.tag, citation: c.citation, content: c.bodyHtml, base: c.bodyHtml }])}>{c.tag || "(no tag)"} <span className="text-[11px] text-muted">{c.citation}</span></button>)}
              {!cq && <p className="text-muted">Type to search your evidence library. Citations and highlighting are copied with the card.</p>}</div>
          )}
          {panel === "flow" && (
            <div>
              <p className="mb-2 text-muted">Select arguments from the linked round’s flow. Their attached evidence comes along; each entry stays linked for explicit sync.</p>
              <div className="max-h-44 overflow-auto">{roundArgs.map((a) => (
                <label key={a.id} className="flex items-start gap-2 py-0.5"><input type="checkbox" checked={picked.has(a.id)} onChange={() => { const n = new Set(picked); n.has(a.id) ? n.delete(a.id) : n.add(a.id); setPicked(n); }} />
                  <span><span className="chip mr-1">{a.flow}</span>{htmlToText(a.text) || "(empty)"}</span></label>
              ))}{roundArgs.length === 0 && <p className="text-muted">That round has no arguments yet.</p>}</div>
              <button className="btn btn-primary mt-2" disabled={!picked.size} onClick={() => { const r = addArgsToDoc(doc, [...picked], args, cards); put(r.doc); useStore.getState().toast(`Added ${r.added}${r.skipped ? `, ${r.skipped} already in document` : ""}`); setPicked(new Set()); setPanel(null); }}>Add {picked.size} to document</button>
            </div>
          )}
          {panel === "sync" && (
            <div>
              <p className="mb-2 text-muted">Nothing changes until you apply. “Update” takes the flow/library text; “Keep mine” keeps this document’s text and marks the source as reviewed.</p>
              {sync.filter((s) => s.state !== "unchanged").length === 0 && <p className="text-ok">Everything is in sync.</p>}
              {sync.filter((s) => s.state !== "unchanged").map((s) => (
                <div key={s.entryId} className="mb-2 rounded border border-line bg-panel p-2">
                  <div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{s.label || "(empty)"}</span><span className={`text-[11px] ${STATE_STYLE[s.state]}`}>{STATE_TEXT[s.state]}</span></div>
                  {(s.state === "incoming" || s.state === "conflict") && s.source !== null && (
                    <div className="mt-1 grid grid-cols-2 gap-2 text-[12px]">
                      <div><div className="label">This document</div><Html html={s.content} /></div>
                      <div><div className="label">Flow / library now</div><Html html={s.source} /></div>
                      <div className="col-span-2 flex gap-3">
                        {(["source", "mine"] as const).map((c) => <label key={c} className="flex items-center gap-1"><input type="radio" name={s.entryId} checked={decisions[s.entryId] === c} onChange={() => setDecisions({ ...decisions, [s.entryId]: c })} />{c === "source" ? "Update from source" : "Keep mine"}</label>)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <button className="btn btn-primary" disabled={!Object.keys(decisions).length} onClick={() => { put(applySync(doc, decisions, roundId ? args : {}, cards)); setDecisions({}); }}>Apply {Object.keys(decisions).length} decision(s)</button>
                <button className="btn" onClick={() => { const d: Record<string, "source"> = {}; pending.filter((p) => p.state === "incoming").forEach((p) => (d[p.entryId] = "source")); setDecisions(d); }}>Select all non-conflicting updates</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="no-print flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-3xl space-y-2">
          {doc.entries.length === 0 && <p className="text-muted">Empty document. Add headings, text, evidence cards, or arguments from the flow.</p>}
          {doc.entries.map((e) => {
            const st = states[e.id];
            return (
              <div key={e.id} draggable onDragStart={() => setDragId(e.id)} onDragOver={(ev) => ev.preventDefault()} onDrop={() => { if (dragId) move(dragId, e.id); setDragId(null); }}
                className={`group rounded-md border bg-panel p-2 ${dragId === e.id ? "opacity-50" : ""} ${st && (st.state === "incoming" || st.state === "conflict") ? "border-warn/60" : "border-line"}`}>
                <div className="mb-1 flex items-center gap-1 text-[11px] text-muted">
                  <span className="cursor-grab select-none" title="Drag to reorder">⠿</span>
                  <span>{e.kind === "arg" ? "Argument (from flow)" : e.kind === "card" ? "Evidence card" : e.kind === "heading" ? "Heading" : "Text"}</span>
                  {st && st.state !== "unchanged" && <span className={STATE_STYLE[st.state]}>· {STATE_TEXT[st.state]}</span>}
                  <span className="ml-auto flex gap-1"><button className="btn btn-ghost px-1" onClick={() => step(e.id, -1)}>↑</button><button className="btn btn-ghost px-1" onClick={() => step(e.id, 1)}>↓</button>
                    <button className="btn btn-ghost px-1 text-bad" onClick={() => { const gone = e; setEntries(doc.entries.filter((x) => x.id !== e.id)); useStore.getState().toast("Removed entry", () => put({ ...useDocs.getState().docs[doc.id], entries: [...useDocs.getState().docs[doc.id].entries, gone] })); }}>×</button></span>
                </div>
                {e.kind === "heading" && (
                  <div className="flex gap-2"><select className="input w-16" value={e.level} onChange={(ev) => patch(e.id, { level: +ev.target.value as 1 | 2 | 3 })}>{[1, 2, 3].map((l) => <option key={l} value={l}>H{l}</option>)}</select>
                    <input className="input font-semibold" defaultValue={e.text} onKeyDown={stop} onBlur={(ev) => patch(e.id, { text: ev.target.value })} /></div>
                )}
                {e.kind === "text" && <RichText html={e.html} onChange={(h) => patch(e.id, { html: h })} minHeight={40} />}
                {e.kind === "arg" && <RichText html={e.content} onChange={(h) => patch(e.id, { content: h })} minHeight={36} />}
                {e.kind === "card" && (
                  <div className="space-y-1">
                    <input className="input font-medium" defaultValue={e.tag} onKeyDown={stop} onBlur={(ev) => patch(e.id, { tag: ev.target.value })} />
                    <input className="input text-[12px]" defaultValue={e.citation} onKeyDown={stop} onBlur={(ev) => patch(e.id, { citation: ev.target.value })} placeholder="Citation" />
                    <RichText html={e.content} onChange={(h) => patch(e.id, { content: h })} minHeight={60} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="print-only"><PrintView doc={doc} /></div>
    </div>
  );
}

export function PrintView({ doc }: { doc: SpeechDoc }) {
  return (
    <article className="print-doc">
      <h1>{doc.title}</h1>
      {doc.entries.map((e) =>
        e.kind === "heading" ? (e.level === 1 ? <h2 key={e.id}>{e.text}</h2> : e.level === 2 ? <h3 key={e.id}>{e.text}</h3> : <h4 key={e.id}>{e.text}</h4>)
        : e.kind === "text" ? <Html key={e.id} html={e.html} />
        : e.kind === "arg" ? <Html key={e.id} html={e.content} />
        : <section key={e.id} className="print-card"><h4>{e.tag}</h4><p className="cite">{e.citation}</p><Html html={e.content} /></section>)}
    </article>
  );
}

"use client";
import { useState } from "react";
import { parsePastedText } from "@/lib/cite";
import { importDocx } from "@/lib/docx-import";
import type { EvidenceCard } from "@/lib/library";
import { useLib } from "@/lib/lib-store";
import { useStore } from "@/lib/store";

export function ImportPanel({ folderId, onDone }: { folderId: string | null; onDone(ids: string[]): void }) {
  const [tab, setTab] = useState<"paste" | "url" | "docx">("paste");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [found, setFound] = useState<Partial<EvidenceCard>[] | null>(null);
  const [pick, setPick] = useState<Set<number>>(new Set());
  const add = (cs: Partial<EvidenceCard>[]) => { const ids = useLib.getState().addCards(cs.map((c) => ({ ...c, folderId }))); useStore.getState().toast(`Imported ${ids.length} card${ids.length === 1 ? "" : "s"}`); onDone(ids); };

  async function fromUrl() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/import-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Import failed");
      setFound([j.card]); setPick(new Set([0]));
    } catch (e) { setErr(e instanceof Error ? e.message : "Import failed"); } finally { setBusy(false); }
  }
  async function fromFile(f: File) {
    setBusy(true); setErr("");
    try {
      const cards = await importDocx(await f.arrayBuffer());
      if (!cards.length) throw new Error("No cards found. Expected Heading 4 tags (Verbatim style); Heading 1 = topic, Heading 2/3 = contention.");
      setFound(cards); setPick(new Set(cards.map((_, i) => i)));
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not read file"); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2"><h2 className="text-[15px] font-medium">Import evidence</h2><span className="chip">deterministic rules · no AI</span></div>
      <div className="flex gap-1">{(["paste", "url", "docx"] as const).map((t) => <button key={t} className={`btn ${tab === t ? "btn-primary" : ""}`} onClick={() => { setTab(t); setFound(null); setErr(""); }}>{t === "paste" ? "Paste text" : t === "url" ? "From URL" : "DOCX file"}</button>)}</div>
      {tab === "paste" && (
        <>
          <p className="text-[12px] text-muted">Blank-line separated: <b>tag</b>, then <b>citation</b> (a line with a year or URL), then the card text. Without that shape everything becomes the body and the first words become the tag.</p>
          <textarea className="input min-h-40" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Paste card text…" />
          <button className="btn btn-primary" disabled={!text.trim()} onClick={() => add([parsePastedText(text)])}>Create card</button>
        </>
      )}
      {tab === "url" && (
        <>
          <p className="text-[12px] text-muted">Fetches the page and reads its title, author, site, date and paragraphs. Review before relying on it — metadata is often missing.</p>
          <div className="flex gap-2"><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") void fromUrl(); }} placeholder="https://…" /><button className="btn btn-primary" disabled={!url || busy} onClick={fromUrl}>{busy ? "Fetching…" : "Fetch"}</button></div>
        </>
      )}
      {tab === "docx" && (
        <>
          <p className="text-[12px] text-muted">Import a debate evidence document. Heading 4 = card tag; the next line with a year/URL = citation; bold, underline, strike and highlighting are kept. Heading 1 → topic, Heading 2/3 → contention.</p>
          <input type="file" accept=".docx" onChange={(e) => e.target.files?.[0] && void fromFile(e.target.files[0])} />
        </>
      )}
      {err && <p className="text-[13px] text-bad">{err}</p>}
      {found && (
        <div className="rounded-md border border-line">
          <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-[12px] text-muted"><span>{found.length} card{found.length === 1 ? "" : "s"} found</span><button className="text-accent" onClick={() => setPick(pick.size === found.length ? new Set() : new Set(found.map((_, i) => i)))}>toggle all</button></div>
          <div className="max-h-64 overflow-auto">
            {found.map((c, i) => (
              <label key={i} className="flex cursor-pointer items-start gap-2 border-b border-line px-3 py-1.5 text-[13px]">
                <input type="checkbox" checked={pick.has(i)} onChange={() => { const n = new Set(pick); n.has(i) ? n.delete(i) : n.add(i); setPick(n); }} />
                <span><span className="block">{c.tag || "(no tag)"}</span><span className="text-[11px] text-muted">{c.citation || "no citation"}{c.topic ? ` · ${c.topic}` : ""}</span></span>
              </label>
            ))}
          </div>
          <div className="p-2"><button className="btn btn-primary" disabled={!pick.size} onClick={() => add(found.filter((_, i) => pick.has(i)))}>Add {pick.size} to library</button></div>
        </div>
      )}
    </div>
  );
}

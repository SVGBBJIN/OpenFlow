"use client";
import { useEffect, useMemo, useState } from "react";
import { docxBlob, download, safeName, type ExportNode } from "@/lib/export-docx";
import { descendantsOf, searchCards, type EvidenceCard } from "@/lib/library";
import { useLib } from "@/lib/lib-store";
import { CardEditor } from "./CardEditor";
import { FolderTree } from "./FolderTree";
import { ImportPanel } from "./ImportPanel";

type Filter = { kind: "all" | "unfiled" | "folder" | "topic" | "tag" | "collection"; value: string };

function Item({ f, label, n, filter, setFilter }: { f: Filter; label: string; n?: number; filter: Filter; setFilter(f: Filter): void }) {
  return (
    <button onClick={() => setFilter(f)} className={`flex w-full items-center justify-between rounded px-2 py-0.5 text-left text-[13px] ${filter.kind === f.kind && filter.value === f.value ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}>
      <span className="truncate">{label}</span>{n !== undefined && <span className="text-[11px]">{n}</span>}
    </button>
  );
}

export function cardsToNodes(cards: EvidenceCard[]): ExportNode[] {
  return cards.map((c) => ({ type: "card" as const, tag: c.tag || "(untitled)", citation: c.citation, html: c.bodyHtml }));
}

export function EvidenceLibrary() {
  const ready = useLib((s) => s.ready);
  const cards = useLib((s) => s.cards);
  const folders = useLib((s) => s.folders);
  const { load, addCard, deleteCards, moveCards, updateCard } = useLib.getState();
  const [filter, setFilter] = useState<Filter>({ kind: "all", value: "" });
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [collection, setCollection] = useState("");
  useEffect(() => { void load().then(() => { const id = new URLSearchParams(window.location.search).get("card"); if (id) setActive(id); }); }, [load]);

  const all = useMemo(() => Object.values(cards).sort((a, b) => b.updatedAt - a.updatedAt), [cards]);
  const visible = useMemo(() => {
    let l = all;
    const f = filter;
    if (f.kind === "unfiled") l = l.filter((c) => !c.folderId);
    if (f.kind === "folder") { const ids = new Set(descendantsOf(folders, f.value)); l = l.filter((c) => c.folderId && ids.has(c.folderId)); }
    if (f.kind === "topic") l = l.filter((c) => c.topic === f.value);
    if (f.kind === "tag") l = l.filter((c) => c.tags.includes(f.value));
    if (f.kind === "collection") l = l.filter((c) => c.collections.includes(f.value));
    return searchCards(l, q);
  }, [all, filter, folders, q]);

  const counts = useMemo(() => { const m: Record<string, number> = {}; for (const c of all) if (c.folderId) m[c.folderId] = (m[c.folderId] ?? 0) + 1; return m; }, [all]);
  const distinct = (get: (c: EvidenceCard) => string[]) => [...new Set(all.flatMap(get).filter(Boolean))].sort();
  const topics = distinct((c) => [c.topic]), tags = distinct((c) => c.tags), collections = distinct((c) => c.collections);
  const activeCard = active ? cards[active] : null;
  const selIds = [...sel].filter((id) => cards[id]);
  const toggle = (id: string) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };

  const exportCards = async (ids: string[], fmt: "docx" | "json") => {
    const cs = ids.map((i) => cards[i]).filter(Boolean);
    if (fmt === "json") return download(new Blob([JSON.stringify(cs, null, 2)], { type: "application/json" }), "evidence.json");
    download(await docxBlob(cs.length ? cardsToNodes(cs) : []), `${safeName("evidence")}.docx`);
  };

  if (!ready) return <p className="p-6 text-muted">Loading…</p>;
  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 space-y-4 overflow-auto border-r border-line bg-panel p-3">
        <div><Item filter={filter} setFilter={setFilter} f={{ kind: "all", value: "" }} label="All cards" n={all.length} /><Item filter={filter} setFilter={setFilter} f={{ kind: "unfiled", value: "" }} label="Unfiled" n={all.filter((c) => !c.folderId).length} /></div>
        <FolderTree scope="evidence" selected={filter.kind === "folder" ? filter.value : null} onSelect={(id) => setFilter(id ? { kind: "folder", value: id } : { kind: "all", value: "" })} counts={counts} />
        {topics.length > 0 && <div><div className="label mb-1">Topics</div>{topics.map((t) => <Item key={t} filter={filter} setFilter={setFilter} f={{ kind: "topic", value: t }} label={t} />)}</div>}
        {collections.length > 0 && <div><div className="label mb-1">Collections</div>{collections.map((t) => <Item key={t} filter={filter} setFilter={setFilter} f={{ kind: "collection", value: t }} label={t} />)}</div>}
        {tags.length > 0 && <div><div className="label mb-1">Tags</div>{tags.map((t) => <Item key={t} filter={filter} setFilter={setFilter} f={{ kind: "tag", value: t }} label={`#${t}`} />)}</div>}
      </aside>

      <section className="flex w-[420px] shrink-0 flex-col border-r border-line">
        <div className="flex items-center gap-2 border-b border-line p-2">
          <input className="input" placeholder="Search tag, author, text, topic…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn" onClick={() => { setImporting(true); setActive(null); }}>Import</button>
          <button className="btn btn-primary" onClick={() => { const id = addCard({ tag: "New card", folderId: filter.kind === "folder" ? filter.value : null }); setActive(id); setImporting(false); }}>＋ Card</button>
        </div>
        {selIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 border-b border-line bg-raised p-2 text-[12px]">
            <span>{selIds.length} selected</span>
            <select className="input w-auto py-0.5" value="" onChange={(e) => { if (e.target.value !== "") { moveCards(selIds, e.target.value === "__none" ? null : e.target.value); setSel(new Set()); } }}>
              <option value="">Move to…</option><option value="__none">Unfiled</option>{folders.filter((f) => f.scope === "evidence").map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input className="input w-28 py-0.5" placeholder="+ collection" value={collection} onChange={(e) => setCollection(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && collection.trim()) { selIds.forEach((id) => updateCard(id, { collections: [...new Set([...cards[id].collections, collection.trim()])] })); setCollection(""); } }} />
            <button className="btn px-2 py-0.5" onClick={() => void exportCards(selIds, "docx")}>DOCX</button>
            <button className="btn px-2 py-0.5" onClick={() => void exportCards(selIds, "json")}>JSON</button>
            <button className="btn px-2 py-0.5 text-bad" onClick={() => { deleteCards(selIds); setSel(new Set()); if (active && selIds.includes(active)) setActive(null); }}>Delete</button>
            <button className="text-muted hover:text-fg" onClick={() => setSel(new Set())}>clear</button>
          </div>
        )}
        <div className="flex items-center gap-2 border-b border-line px-3 py-1 text-[11px] text-muted">
          <label className="flex items-center gap-1"><input type="checkbox" checked={visible.length > 0 && visible.every((c) => sel.has(c.id))} onChange={(e) => setSel(e.target.checked ? new Set(visible.map((c) => c.id)) : new Set())} /> select all</label>
          <span className="ml-auto">{visible.length} card{visible.length === 1 ? "" : "s"}</span>
        </div>
        <div className="flex-1 overflow-auto">
          {visible.length === 0 && <p className="p-4 text-[13px] text-muted">{all.length ? "No cards match." : "No evidence yet. Use Import (paste, URL, DOCX) or ＋ Card."}</p>}
          {visible.map((c) => (
            <div key={c.id} onClick={() => { setActive(c.id); setImporting(false); }} className={`flex cursor-pointer items-start gap-2 border-b border-line px-3 py-2 ${active === c.id ? "bg-raised" : "hover:bg-raised/60"}`}>
              <input type="checkbox" checked={sel.has(c.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(c.id)} />
              <div className="min-w-0"><div className="truncate text-[13px]">{c.tag || <span className="text-muted">(no tag)</span>}</div><div className="truncate text-[11px] text-muted">{c.citation || [c.author, c.date].filter(Boolean).join(" ") || "no citation"}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section className="min-w-0 flex-1 overflow-auto">
        {importing ? <ImportPanel folderId={filter.kind === "folder" ? filter.value : null} onDone={(ids) => { setImporting(false); setActive(ids[0] ?? null); }} />
          : activeCard ? <CardEditor card={activeCard} />
          : <p className="p-6 text-[13px] text-muted">Select a card to edit it, or import evidence.</p>}
      </section>
    </div>
  );
}

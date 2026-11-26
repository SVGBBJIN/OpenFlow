"use client";
import { useEffect, useMemo, useState } from "react";
import { newId } from "@/lib/flow-ops";
import { BLOCK_KINDS, BLOCK_KIND_LABEL, descendantsOf, searchCards, slugBlockName, type Block, type BlockKind } from "@/lib/library";
import { useLib } from "@/lib/lib-store";
import { FolderTree } from "../evidence/FolderTree";
import { Html, RichText } from "../RichText";

const stop = (e: React.KeyboardEvent) => { e.stopPropagation(); if (e.key === "Escape") (e.target as HTMLElement).blur(); };

export function BlockLibrary() {
  const ready = useLib((s) => s.ready);
  const blocks = useLib((s) => s.blocks);
  const folders = useLib((s) => s.folders);
  const { load, addBlock, deleteBlock } = useLib.getState();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<BlockKind | "">("");
  const [folder, setFolder] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    const ids = folder ? new Set(descendantsOf(folders, folder)) : null;
    const w = q.toLowerCase().replace(/^\//, "").split(/\s+/).filter(Boolean);
    return Object.values(blocks).filter((b) => (!kind || b.kind === kind) && (!ids || (b.folderId && ids.has(b.folderId))) && w.every((x) => (b.name + " " + b.topic + " " + BLOCK_KIND_LABEL[b.kind]).toLowerCase().includes(x))).sort((a, b) => a.name.localeCompare(b.name));
  }, [blocks, folders, q, kind, folder]);
  const counts = useMemo(() => { const m: Record<string, number> = {}; for (const b of Object.values(blocks)) if (b.folderId) m[b.folderId] = (m[b.folderId] ?? 0) + 1; return m; }, [blocks]);
  const ab = active ? blocks[active] : null;

  if (!ready) return <p className="p-6 text-muted">Loading…</p>;
  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 space-y-3 overflow-auto border-r border-line bg-panel p-3">
        <button className={`w-full rounded px-2 py-0.5 text-left text-[13px] ${folder === null ? "bg-raised" : "text-muted"}`} onClick={() => setFolder(null)}>All blocks <span className="float-right text-[11px]">{Object.keys(blocks).length}</span></button>
        <FolderTree scope="blocks" selected={folder} onSelect={setFolder} counts={counts} />
        <p className="text-[11px] leading-snug text-muted">Type <span className="kbd">/</span> in the flow, then a block name to preview and insert it into the selected argument.</p>
      </aside>
      <section className="flex w-80 shrink-0 flex-col border-r border-line">
        <div className="space-y-2 border-b border-line p-2">
          <div className="flex gap-2"><input className="input" placeholder="Search /name, topic…" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn btn-primary" onClick={() => setActive(addBlock({ name: `block-${Object.keys(blocks).length + 1}`, folderId: folder }))}>＋</button></div>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as BlockKind | "")}><option value="">All types</option>{BLOCK_KINDS.map((k) => <option key={k} value={k}>{BLOCK_KIND_LABEL[k]}</option>)}</select>
        </div>
        <div className="flex-1 overflow-auto">
          {list.length === 0 && <p className="p-4 text-[13px] text-muted">No blocks. Create one with ＋.</p>}
          {list.map((b) => (
            <button key={b.id} onClick={() => setActive(b.id)} className={`block w-full border-b border-line px-3 py-2 text-left ${active === b.id ? "bg-raised" : "hover:bg-raised/60"}`}>
              <div className="text-[13px]">/{b.name}</div><div className="text-[11px] text-muted">{BLOCK_KIND_LABEL[b.kind]}{b.topic ? ` · ${b.topic}` : ""} · {b.entries.length} item(s)</div>
            </button>
          ))}
        </div>
      </section>
      <section className="min-w-0 flex-1 overflow-auto">{ab ? <BlockEditor key={ab.id} block={ab} onDelete={() => { deleteBlock(ab.id); setActive(null); }} /> : <p className="p-6 text-[13px] text-muted">Select or create a block.</p>}</section>
    </div>
  );
}

function BlockEditor({ block, onDelete }: { block: Block; onDelete(): void }) {
  const { updateBlock } = useLib.getState();
  const cards = useLib((s) => s.cards);
  const folders = useLib((s) => s.folders).filter((f) => f.scope === "blocks");
  const [cq, setCq] = useState("");
  const set = (entries: Block["entries"]) => updateBlock(block.id, { entries });
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= block.entries.length) return; const e = [...block.entries]; [e[i], e[j]] = [e[j], e[i]]; set(e); };
  const results = cq ? searchCards(Object.values(cards), cq).slice(0, 8) : [];

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <label><span className="label">Slash name</span><div className="mt-1 flex items-center gap-1"><span className="text-muted">/</span><input className="input" defaultValue={block.name} onKeyDown={stop} onBlur={(e) => updateBlock(block.id, { name: slugBlockName(e.target.value) })} /></div></label>
        <label><span className="label">Type</span><select className="input mt-1" value={block.kind} onChange={(e) => updateBlock(block.id, { kind: e.target.value as BlockKind })}>{BLOCK_KINDS.map((k) => <option key={k} value={k}>{BLOCK_KIND_LABEL[k]}</option>)}</select></label>
        <label><span className="label">Topic</span><input className="input mt-1" defaultValue={block.topic} onKeyDown={stop} onBlur={(e) => updateBlock(block.id, { topic: e.target.value })} /></label>
        <label><span className="label">Folder / file</span><select className="input mt-1" value={block.folderId ?? ""} onChange={(e) => updateBlock(block.id, { folderId: e.target.value || null })}><option value="">— none —</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      </div>
      <div className="space-y-2">
        <div className="label">Contents (inserted in this order)</div>
        {block.entries.length === 0 && <p className="text-[13px] text-muted">Empty. Add cards from the library or your own text.</p>}
        {block.entries.map((e, i) => {
          const c = e.cardId ? cards[e.cardId] : null;
          return (
            <div key={e.id} className="rounded-md border border-line bg-panel p-2">
              <div className="mb-1 flex items-center gap-1 text-[11px] text-muted">
                <span>{e.type === "card" ? "Card" : "Text"} {i + 1}</span>
                <span className="ml-auto flex gap-1"><button className="btn btn-ghost px-1" onClick={() => move(i, -1)}>↑</button><button className="btn btn-ghost px-1" onClick={() => move(i, 1)}>↓</button><button className="btn btn-ghost px-1 text-bad" onClick={() => set(block.entries.filter((x) => x.id !== e.id))}>remove</button></span>
              </div>
              {e.type === "text" ? <RichText html={e.html} onChange={(h) => set(block.entries.map((x) => (x.id === e.id ? { ...x, html: h } : x)))} minHeight={50} />
                : c ? <div><div className="text-[13px] font-medium">{c.tag}</div><div className="text-[11px] text-muted">{c.citation}</div><Html html={c.bodyHtml} className="mt-1 text-[12px]" /></div>
                : <p className="text-[12px] text-bad">This card was deleted from the library.</p>}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2"><button className="btn" onClick={() => set([...block.entries, { id: newId(), type: "text", cardId: null, html: "" }])}>＋ Text</button></div>
      <div>
        <div className="label mb-1">Add evidence card</div>
        <input className="input" placeholder="Search cards…" value={cq} onChange={(e) => setCq(e.target.value)} onKeyDown={stop} />
        {results.map((c) => <button key={c.id} className="mt-1 block w-full rounded border border-line px-2 py-1 text-left text-[13px] hover:bg-raised" onClick={() => { set([...block.entries, { id: newId(), type: "card", cardId: c.id, html: "" }]); setCq(""); }}>{c.tag || "(no tag)"} <span className="text-[11px] text-muted">{c.citation}</span></button>)}
      </div>
      <div className="border-t border-line pt-3"><button className="btn text-bad" onClick={onDelete}>Delete block</button></div>
    </div>
  );
}

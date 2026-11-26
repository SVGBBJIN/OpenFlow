"use client";
import { useState } from "react";
import { autoCitation, highlightedText, type EvidenceCard } from "@/lib/library";
import { useLib } from "@/lib/lib-store";
import { RichText } from "../RichText";

const stop = (e: React.KeyboardEvent) => { e.stopPropagation(); if (e.key === "Escape") (e.target as HTMLElement).blur(); };

type TextKey = "tag" | "author" | "publication" | "date" | "url" | "topic" | "contention";
function F({ card, k, label, wide }: { card: EvidenceCard; k: TextKey; label: string; wide?: boolean }) {
  return (
    <label className={wide ? "col-span-2" : ""}><span className="label">{label}</span>
      <input className="input mt-1" defaultValue={card[k]} onKeyDown={stop} onBlur={(e) => e.target.value !== card[k] && useLib.getState().updateCard(card.id, { [k]: e.target.value })} />
    </label>
  );
}
function L({ card, k, label }: { card: EvidenceCard; k: "tags" | "collections"; label: string }) {
  return (
    <label><span className="label">{label} (comma separated)</span>
      <input className="input mt-1" defaultValue={card[k].join(", ")} onKeyDown={stop} onBlur={(e) => useLib.getState().updateCard(card.id, { [k]: [...new Set(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))] })} />
    </label>
  );
}

export function CardEditor({ card }: { card: EvidenceCard }) {
  const { updateCard } = useLib.getState();
  const folders = useLib((s) => s.folders).filter((f) => f.scope === "evidence");
  const [onlyHl, setOnlyHl] = useState(false);
  return (
    <div className="space-y-3 p-4" key={card.id}>
      <div className="grid grid-cols-2 gap-3">
        <F card={card} k="tag" label="Tag (claim)" wide />
        <F card={card} k="author" label="Author" /><F card={card} k="publication" label="Publication" />
        <F card={card} k="date" label="Publication date" /><F card={card} k="url" label="URL" />
        <F card={card} k="topic" label="Topic" /><F card={card} k="contention" label="Contention" />
        <label><span className="label">Folder / file</span>
          <select className="input mt-1" value={card.folderId ?? ""} onChange={(e) => updateCard(card.id, { folderId: e.target.value || null })}>
            <option value="">— Unfiled —</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.kind === "file" ? "▤ " : "▸ "}{f.name}</option>)}
          </select>
        </label>
        <L card={card} k="tags" label="Custom tags" /><L card={card} k="collections" label="Collections" />
      </div>
      <label className="block"><span className="label">Citation</span>
        <div className="mt-1 flex gap-2">
          <input className="input" key={card.citation} defaultValue={card.citation} onKeyDown={stop} onBlur={(e) => e.target.value !== card.citation && updateCard(card.id, { citation: e.target.value })} placeholder={autoCitation(card)} />
          <button className="btn" title="Build from author, publication, date and URL" onClick={() => updateCard(card.id, { citation: autoCitation(card) })}>From fields</button>
        </div>
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between"><span className="label">Full source text — highlight what you will read</span>
          <label className="flex items-center gap-1 text-[12px] text-muted"><input type="checkbox" checked={onlyHl} onChange={(e) => setOnlyHl(e.target.checked)} /> show highlighted only</label>
        </div>
        {onlyHl ? <p className="rounded-md border border-line bg-bg p-2 text-[13px]">{highlightedText(card.bodyHtml) || <span className="text-muted">Nothing highlighted yet.</span>}</p>
          : <RichText html={card.bodyHtml} onChange={(h) => updateCard(card.id, { bodyHtml: h })} minHeight={160} placeholder="Card text" />}
      </div>
      <label className="block"><span className="label">Notes</span>
        <textarea className="input mt-1 min-h-14" defaultValue={card.notes} onKeyDown={stop} onBlur={(e) => e.target.value !== card.notes && updateCard(card.id, { notes: e.target.value })} />
      </label>
    </div>
  );
}

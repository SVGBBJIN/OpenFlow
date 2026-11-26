"use client";
import Link from "next/link";
import { useState } from "react";
import { useLib } from "@/lib/lib-store";
import { useStore } from "@/lib/store";
import type { Insert } from "@/lib/types";
import { Html, RichText } from "./RichText";

/** Library material attached to the selected argument. Every entry stays individually editable / removable. */
export function InsertsPanel({ argId }: { argId: string }) {
  const inserts = useStore((s) => s.args[argId]?.inserts ?? []);
  const cards = useLib((s) => s.cards);
  const [open, setOpen] = useState<string | null>(null);
  const write = (next: Insert[]) => useStore.getState().patchArg(argId, { inserts: next.filter((i) => i.entries.length > 0) });
  if (!inserts.length) return <p className="text-[11px] text-muted">No evidence attached. Press <span className="kbd">/</span> to insert a block or card.</p>;
  return (
    <div>
      <div className="label mb-1">Inserted material</div>
      <div className="space-y-2">
        {inserts.map((ins) => (
          <div key={ins.id} className="rounded-md border border-line p-2">
            <div className="mb-1 flex items-center text-[12px]"><span className="font-medium">{ins.blockId ? `/${ins.name}` : ins.name}</span>
              <button className="ml-auto text-muted hover:text-bad" onClick={() => write(inserts.filter((x) => x.id !== ins.id))}>remove all</button></div>
            {ins.entries.map((e) => {
              const src = e.cardId ? cards[e.cardId] : null;
              const stale = !!src && src.bodyHtml !== e.html;
              return (
                <div key={e.id} className="mb-1.5 border-t border-line pt-1.5 first:border-0 first:pt-0">
                  <div className="flex items-start gap-1 text-[12px]">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === e.id ? null : e.id)}>
                      <span className="block truncate">{e.kind === "card" ? e.tag || "(no tag)" : "Text"}</span>
                      {e.citation && <span className="block truncate text-[11px] text-muted">{e.citation}</span>}
                    </button>
                    <button title="Remove this item" className="text-muted hover:text-bad" onClick={() => write(inserts.map((x) => (x.id === ins.id ? { ...x, entries: x.entries.filter((y) => y.id !== e.id) } : x)))}>×</button>
                  </div>
                  {open === e.id && (
                    <div className="mt-1 space-y-1">
                      <RichText html={e.html} minHeight={60} onChange={(h) => write(inserts.map((x) => (x.id === ins.id ? { ...x, entries: x.entries.map((y) => (y.id === e.id ? { ...y, html: h } : y)) } : x)))} />
                      <div className="flex gap-2 text-[11px]">
                        {src && <Link className="text-accent hover:underline" href={`/evidence?card=${src.id}`}>open original</Link>}
                        {stale && src && <button className="text-warn hover:underline" onClick={() => write(inserts.map((x) => (x.id === ins.id ? { ...x, entries: x.entries.map((y) => (y.id === e.id ? { ...y, html: src.bodyHtml, tag: src.tag, citation: src.citation || y.citation } : y)) } : x)))}>library copy changed — refresh</button>}
                        {e.cardId && !src && <span className="text-bad">original deleted</span>}
                      </div>
                    </div>
                  )}
                  {open !== e.id && <Html html={e.html} className="mt-0.5 line-clamp-2 text-[11px] text-muted" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

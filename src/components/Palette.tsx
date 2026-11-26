"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { prettyCombo, type ActionId } from "@/lib/keymap";
import { useStore } from "@/lib/store";
import { STATUSES } from "@/lib/types";
import { BLOCK_KIND_LABEL, blockToInsert, cardToInsertEntry, searchCards } from "@/lib/library";
import { useLib } from "@/lib/lib-store";
import { newId } from "@/lib/flow-ops";
import { Html } from "./RichText";

interface Cmd { id: string; label: string; hint?: string; run(): void; keep?: boolean; preview?: React.ReactNode }

export function Palette() {
  const open = useStore((s) => s.paletteOpen);
  return open ? <PaletteInner /> : null;
}

function PaletteInner() {
  const open = true;
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<"commands" | "cards">("commands");
  const lib = useLib();
  const inputRef = useRef<HTMLInputElement>(null);
  const st = useStore;

  const cmds = useMemo<Cmd[]>(() => {
    if (!open) return [];
    const s = st.getState();
    const key = (a: ActionId) => prettyCombo(s.keymap[a]);
    const sel = s.selectedId && s.args[s.selectedId] ? s.selectedId : null;
    const list: Cmd[] = [
      { id: "contention", label: "New contention", hint: key("newContention"), run: () => s.newContention() },
    ];
    if (sel) {
      list.push(
        { id: "arg", label: "New argument (sibling)", hint: key("newArgument"), run: () => s.newSibling() },
        { id: "resp", label: "New response in next speech", hint: key("newResponse"), run: () => s.newResponse() },
        { id: "turn", label: "Add turn response", hint: key("turn"), run: () => s.newResponse({ isTurn: true }) },
        { id: "extend", label: "Extend into next speech", hint: key("extend"), run: () => s.newResponse({ extend: true }) },
        { id: "edit", label: "Edit selected argument", hint: key("startEdit"), run: () => s.beginEdit(sel) },
        { id: "collapse", label: s.args[sel].collapsed ? "Expand argument tree" : "Collapse argument tree", hint: key("toggleCollapse"), run: () => s.toggleCollapse(sel) },
        { id: "link", label: "Link to another argument…", run: () => s.setPick({ kind: "link", from: sel }) },
        { id: "reparent", label: "Move under another argument…", run: () => s.setPick({ kind: "reparent", from: sel }) },
        ...(s.args[sel].parentId ? [{ id: "detach", label: "Make top-level contention", run: () => s.detach(sel) }] : []),
        { id: "colL", label: "Move to earlier speech", hint: key("colLeft"), run: () => s.shiftColumn(-1) },
        { id: "colR", label: "Move to later speech", hint: key("colRight"), run: () => s.shiftColumn(1) },
        { id: "up", label: "Reorder up", hint: key("moveUp"), run: () => s.move(-1) },
        { id: "down", label: "Reorder down", hint: key("moveDown"), run: () => s.move(1) },
        ...STATUSES.map((x, n) => ({ id: `st-${x}`, label: `Status: ${x}`, hint: prettyCombo(`alt+${n + 1}`), run: () => s.setStatus(sel, x) })),
        ...[0, 1, 2, 3].map((p) => ({ id: `pr-${p}`, label: p ? `Priority ${p}` : "Clear priority", run: () => s.patchArg(sel, { priority: p as 0 | 1 | 2 | 3 }) })),
        { id: "del", label: "Delete argument and responses", hint: key("deleteArg"), run: () => s.deleteSelected() },
      );
      const t = q.replace(/^tag\s+/i, "").trim().replace(/^#/, "");
      if (/^tag\s+\S+/i.test(q) && t) list.unshift({ id: "tag", label: `Add tag #${t}`, run: () => s.patchArg(sel, { tags: [...new Set([...s.args[sel].tags, t])] }) });
    }
    if (sel) {
      list.push({ id: "attach", label: "Attach evidence card…", keep: true, run: () => { setMode("cards"); setQ(""); setI(0); } });
      for (const b of Object.values(lib.blocks).sort((a, b) => a.name.localeCompare(b.name))) {
        list.push({
          id: `blk-${b.id}`, label: `/${b.name}`, hint: BLOCK_KIND_LABEL[b.kind],
          preview: <BlockPreview blockId={b.id} />,
          run: () => {
            const { insert, missing } = blockToInsert(b, lib.cards);
            const a = s.args[sel];
            s.patchArg(sel, { inserts: [...a.inserts, insert], evidenceIds: [...new Set([...a.evidenceIds, ...insert.entries.flatMap((e) => (e.cardId ? [e.cardId] : []))])] });
            s.toast(`Inserted /${b.name} (${insert.entries.length} item${insert.entries.length === 1 ? "" : "s"})${missing ? ` — ${missing} missing card(s) skipped` : ""}`);
          },
        });
      }
    }
    list.push(
      { id: "flow", label: `Switch to ${s.flow === "pro" ? "Con" : "Pro"} flow`, hint: key("switchFlow"), run: () => s.setFlow(s.flow === "pro" ? "con" : "pro") },
      { id: "undo", label: "Undo", hint: key("undo"), run: () => s.undo() },
      { id: "redo", label: "Redo", hint: key("redo"), run: () => s.redo() },
    );
    return list;
  }, [open, q, st, lib.blocks, lib.cards]);

  const cardCmds = useMemo<Cmd[]>(() => {
    if (mode !== "cards") return [];
    const s = st.getState();
    const sel = s.selectedId;
    return searchCards(Object.values(lib.cards), q).slice(0, 50).map((c) => ({
      id: `card-${c.id}`, label: c.tag || "(no tag)", hint: c.author || c.date,
      preview: <div className="space-y-1"><div className="text-[12px] font-medium">{c.tag}</div><div className="text-[11px] text-muted">{c.citation}</div><Html html={c.bodyHtml} className="text-[12px]" /></div>,
      run: () => {
        if (!sel || !s.args[sel]) return;
        const a = s.args[sel];
        s.patchArg(sel, { inserts: [...a.inserts, { id: newId(), blockId: null, name: c.tag || "card", entries: [cardToInsertEntry(c)], at: Date.now() }], evidenceIds: [...new Set([...a.evidenceIds, c.id])] });
        s.toast(`Attached “${c.tag}”`);
      },
    }));
  }, [mode, q, lib.cards, st]);

  const shown = useMemo(() => {
    if (mode === "cards") return cardCmds;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return cmds.filter((c) => c.id === "tag" || words.every((w) => c.label.toLowerCase().includes(w)));
  }, [cmds, q]);

  useEffect(() => { inputRef.current?.focus(); void useLib.getState().load(); }, []);

  const close = () => st.getState().setPalette(false);
  const run = (c?: Cmd) => { if (!c) return; if (c.keep) return c.run(); close(); setTimeout(() => c.run(), 0); };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 pt-24" onMouseDown={close}>
      <div className="w-[760px] max-w-[95vw] overflow-hidden rounded-lg border border-line2 bg-panel shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          ref={inputRef} className="w-full border-b border-line bg-transparent px-3 py-2.5 text-[14px] outline-none"
          placeholder={mode === "cards" ? "Search evidence cards… (Esc to go back)" : 'Type a command or /block name  (try "answered", "tag econ", "/econ")'} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") { e.preventDefault(); if (mode === "cards") { setMode("commands"); setQ(""); } else close(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(shown.length - 1, x + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); run(shown[i]); }
          }}
        />
        <div className="flex">
        <ul className="max-h-96 w-1/2 shrink-0 overflow-auto py-1">
          {shown.length === 0 && <li className="px-3 py-2 text-muted">No matching command</li>}
          {shown.map((c, n) => (
            <li key={c.id} onMouseEnter={() => setI(n)} onClick={() => run(c)}
              className={`flex cursor-pointer items-center justify-between px-3 py-1.5 text-[13px] ${n === i ? "bg-raised text-fg" : "text-muted"}`}>
              <span>{c.label}</span>{c.hint && <span className="kbd">{c.hint}</span>}
            </li>
          ))}
        </ul>
        <div className="max-h-96 flex-1 overflow-auto border-l border-line p-3">{shown[i]?.preview ?? <p className="text-[12px] text-muted">{mode === "cards" ? "Enter attaches the card to the selected argument." : "Blocks (/name) preview here before insertion."}</p>}</div>
        </div>
      </div>
    </div>
  );
}

function BlockPreview({ blockId }: { blockId: string }) {
  const b = useLib((s) => s.blocks[blockId]);
  const cards = useLib((s) => s.cards);
  if (!b) return null;
  return (
    <div className="space-y-2">
      <div className="text-[12px] font-medium">/{b.name} <span className="text-muted">· {b.entries.length} item(s)</span></div>
      {b.entries.map((e) => {
        const c = e.cardId ? cards[e.cardId] : null;
        return e.type === "text" ? <Html key={e.id} html={e.html} className="text-[12px]" /> : c ? (
          <div key={e.id} className="rounded border border-line p-1.5"><div className="text-[12px] font-medium">{c.tag}</div><div className="text-[11px] text-muted">{c.citation}</div><Html html={c.bodyHtml} className="text-[12px]" /></div>
        ) : <p key={e.id} className="text-[11px] text-bad">Missing card</p>;
      })}
      {b.entries.length === 0 && <p className="text-[12px] text-muted">Empty block.</p>}
    </div>
  );
}

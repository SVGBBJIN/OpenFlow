"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { prettyCombo, type ActionId } from "@/lib/keymap";
import { useStore } from "@/lib/store";
import { STATUSES } from "@/lib/types";

interface Cmd { id: string; label: string; hint?: string; run(): void }

export function Palette() {
  const open = useStore((s) => s.paletteOpen);
  return open ? <PaletteInner /> : null;
}

function PaletteInner() {
  const open = true;
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
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
    list.push(
      { id: "flow", label: `Switch to ${s.flow === "pro" ? "Con" : "Pro"} flow`, hint: key("switchFlow"), run: () => s.setFlow(s.flow === "pro" ? "con" : "pro") },
      { id: "undo", label: "Undo", hint: key("undo"), run: () => s.undo() },
      { id: "redo", label: "Redo", hint: key("redo"), run: () => s.redo() },
    );
    return list;
  }, [open, q, st]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return cmds.filter((c) => c.id === "tag" || words.every((w) => c.label.toLowerCase().includes(w)));
  }, [cmds, q]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const close = () => st.getState().setPalette(false);
  const run = (c?: Cmd) => { if (!c) return; close(); setTimeout(() => c.run(), 0); };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 pt-24" onMouseDown={close}>
      <div className="w-[480px] overflow-hidden rounded-lg border border-line2 bg-panel shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          ref={inputRef} className="w-full border-b border-line bg-transparent px-3 py-2.5 text-[14px] outline-none"
          placeholder='Type a command…  (try "answered", "tag econ", "link")' value={q} onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") { e.preventDefault(); close(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(shown.length - 1, x + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); run(shown[i]); }
          }}
        />
        <ul className="max-h-80 overflow-auto py-1">
          {shown.length === 0 && <li className="px-3 py-2 text-muted">No matching command</li>}
          {shown.map((c, n) => (
            <li key={c.id} onMouseEnter={() => setI(n)} onClick={() => run(c)}
              className={`flex cursor-pointer items-center justify-between px-3 py-1.5 text-[13px] ${n === i ? "bg-raised text-fg" : "text-muted"}`}>
              <span>{c.label}</span>{c.hint && <span className="kbd">{c.hint}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

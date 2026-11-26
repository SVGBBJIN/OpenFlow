"use client";
import { memo } from "react";
import { sanitizeHtml } from "@/lib/sanitize";
import type { Arg } from "@/lib/types";
import { CellEditor } from "./CellEditor";

export interface CellProps {
  arg: Arg;
  col: number;
  row: number;
  hidden: number;
  rootStart: boolean;
  selected: boolean;
  editing: boolean;
  related: boolean;
  dim: boolean;
  peers?: { name: string; color: string; editing: boolean }[];
  pickable: boolean;
  onSelect(id: string): void;
  onEdit(id: string): void;
  onToggle(id: string): void;
}

export const Cell = memo(function Cell(p: CellProps) {
  const a = p.arg;
  return (
    <div
      data-cell={a.id}
      role="treeitem"
      aria-selected={p.selected}
      className={`cell st-${a.status} ${p.selected ? "sel" : ""} ${p.related ? "rel" : ""} ${p.dim ? "dim" : ""} ${p.pickable ? "pick" : ""}`}
      style={{ gridColumn: p.col + 1, gridRow: p.row + 2, marginTop: p.rootStart && p.row > 0 ? 14 : 0, ...(p.peers?.length ? { outline: `2px solid ${p.peers[0].color}`, outlineOffset: 1 } : {}) }}
      onMouseDown={(e) => { if (!p.editing) { e.preventDefault(); } p.onSelect(a.id); }}
      onDoubleClick={() => p.onEdit(a.id)}
    >
      {p.peers?.map((u) => <span key={u.name} className="peer-badge" style={{ background: u.color, right: 6 }}>{u.name}{u.editing ? " ✎" : ""}</span>)}
      {(a.priority > 0 || a.isTurn || a.extendsId || a.status !== "active" || a.tags.length > 0) && (
        <div className="mb-0.5 flex flex-wrap items-center gap-1">
          {a.priority > 0 && <span className="chip text-warn" title={`Priority ${a.priority}`}>{"!".repeat(a.priority)}</span>}
          {a.isTurn && <span className="chip text-turn">turn</span>}
          {a.extendsId && <span className="chip text-[#4fc3d9]">ext</span>}
          {a.status !== "active" && <span className="chip">{a.status}</span>}
          {a.tags.map((t) => <span key={t} className="chip">#{t}</span>)}
        </div>
      )}
      {p.editing ? (
        <CellEditor key={a.id} id={a.id} initial={a.text} />
      ) : (
        <div className="cell-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.text) || '<span style="color:#55618a">empty</span>' }} />
      )}
      {(a.notes || a.linkedIds.length > 0 || a.impact || a.inserts.length > 0 || p.hidden > 0) && (
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted">
          {a.inserts.length > 0 && <span title={a.inserts.map((i) => `/${i.name}`).join(", ")}>▤ {a.inserts.reduce((n, i) => n + i.entries.length, 0)}</span>}
          {a.notes && <span title={a.notes}>✎ note</span>}
          {a.impact && <span title={a.impact}>⚖ impact</span>}
          {a.linkedIds.length > 0 && <span>⛓ {a.linkedIds.length}</span>}
          {p.hidden > 0 && (
            <button className="ml-auto rounded border border-line2 px-1 hover:text-fg" onMouseDown={(e) => e.stopPropagation()} onClick={() => p.onToggle(a.id)}>
              + {p.hidden} hidden
            </button>
          )}
        </div>
      )}
    </div>
  );
});

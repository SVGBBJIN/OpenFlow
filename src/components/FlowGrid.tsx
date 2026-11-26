"use client";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { layoutFlow } from "@/lib/layout";
import { useStore } from "@/lib/store";
import type { Round } from "@/lib/types";
import { Cell } from "./Cell";

interface Box { x: number; y: number; w: number; h: number }

export function FlowGrid({ round }: { round: Round }) {
  const args = useStore((s) => s.args);
  const flow = useStore((s) => s.flow);
  const selectedId = useStore((s) => s.selectedId);
  const editingId = useStore((s) => s.editingId);
  const pick = useStore((s) => s.pick);
  const { select, beginEdit, toggleCollapse } = useStore.getState();
  const gridRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});

  const colOf = useCallback((sid: string) => round.speeches.findIndex((s) => s.id === sid), [round.speeches]);
  const layout = useMemo(() => layoutFlow(args, flow, colOf), [args, flow, colOf]);

  // Related chain (ancestors + descendants) of the selection gets highlighted.
  const related = useMemo(() => {
    const set = new Set<string>();
    if (!selectedId || !layout.placed[selectedId]) return set;
    let cur = args[selectedId];
    while (cur?.parentId) { set.add(cur.parentId); cur = args[cur.parentId]; }
    const down = (id: string) => { for (const a of Object.values(args)) if (a.parentId === id && layout.placed[a.id]) { set.add(a.id); down(a.id); } };
    down(selectedId);
    for (const l of args[selectedId].linkedIds) set.add(l);
    return set;
  }, [args, layout, selectedId]);

  const measure = useCallback(() => {
    const el = gridRef.current; if (!el) return;
    const next: Record<string, Box> = {};
    el.querySelectorAll<HTMLElement>("[data-cell]").forEach((c) => {
      next[c.dataset.cell!] = { x: c.offsetLeft, y: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight };
    });
    setBoxes((prev) => {
      const ka = Object.keys(next);
      if (ka.length === Object.keys(prev).length && ka.every((k) => { const p = prev[k], n = next[k]; return p && p.x === n.x && p.y === n.y && p.w === n.w && p.h === n.h; })) return prev;
      return next;
    });
  }, []);

  useLayoutEffect(() => { measure(); }, [measure, layout, args, editingId]);
  useLayoutEffect(() => {
    const el = gridRef.current; if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // Keep the selected cell on screen.
  useLayoutEffect(() => {
    if (!selectedId) return;
    gridRef.current?.querySelector(`[data-cell="${selectedId}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId, layout]);

  const edges: { key: string; d: string; hot: boolean; kind: "tree" | "link" }[] = [];
  for (const id of Object.keys(layout.placed)) {
    const a = args[id]; const b = boxes[id];
    if (!b) continue;
    if (a.parentId && boxes[a.parentId] && layout.placed[a.parentId]) {
      const p = boxes[a.parentId];
      const x1 = p.x + p.w, y1 = p.y + 14, x2 = b.x, y2 = b.y + 14;
      const same = Math.abs(b.x - p.x) < 4;
      const d = same
        ? `M ${p.x + 12} ${p.y + p.h} V ${y2 - 0} H ${b.x}`
        : `M ${x1} ${y1} H ${x1 + (x2 - x1) / 2} V ${y2} H ${x2}`;
      edges.push({ key: `t${id}`, d, hot: selectedId === id || selectedId === a.parentId || (related.has(id) && related.has(a.parentId)), kind: "tree" });
    }
    for (const l of a.linkedIds) {
      if (l < id || !boxes[l] || !layout.placed[l]) continue;
      const o = boxes[l];
      const left = o.x > b.x;
      const x1 = left ? b.x + b.w : b.x, x2 = left ? o.x : o.x + o.w;
      const y1 = b.y + b.h / 2, y2 = o.y + o.h / 2, mx = (x1 + x2) / 2;
      edges.push({ key: `l${id}${l}`, d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`, hot: selectedId === id || selectedId === l, kind: "link" });
    }
  }

  const cols = round.speeches.length;
  const rows = Math.max(layout.rows, 1);

  return (
    <div className="relative h-full overflow-auto" role="tree" aria-label={`${flow} flow`}>
      <div
        ref={gridRef}
        className="relative grid min-w-max p-3 pt-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, var(--col-w))`,
          gridTemplateRows: `auto repeat(${rows}, auto)`,
          columnGap: 28,
          rowGap: 6,
          minHeight: "100%",
          alignContent: "start",
        }}
      >
        {round.speeches.map((s, i) => (
          <div key={s.id} className="sticky top-0 z-20 -mx-1 border-b border-line bg-bg/95 px-1 pb-1 pt-3 backdrop-blur" style={{ gridColumn: i + 1, gridRow: 1 }}>
            <div className={`border-t-2 pt-1 text-[12px] font-medium ${s.side === "pro" ? "border-pro text-pro" : "border-con text-con"}`} style={{ borderColor: s.side === "pro" ? "var(--color-pro)" : "var(--color-con)" }}>
              {s.name} <span className="font-normal text-muted">{s.minutes}:00</span>
            </div>
          </div>
        ))}
        <svg className="pointer-events-none absolute left-0 top-0 z-10 h-full w-full overflow-visible" aria-hidden>
          {edges.map((e) => (
            <path key={e.key} d={e.d} fill="none"
              stroke={e.kind === "link" ? "#b58cf5" : e.hot ? "#6ea8ff" : "#2b3a5e"}
              strokeWidth={e.hot ? 1.6 : 1} strokeDasharray={e.kind === "link" ? "4 3" : undefined} />
          ))}
        </svg>
        {layout.order.map((id) => {
          const pl = layout.placed[id];
          return (
            <Cell
              key={id}
              arg={args[id]}
              col={pl.col}
              row={pl.row}
              hidden={pl.hidden}
              rootStart={pl.rootStart}
              selected={selectedId === id}
              editing={editingId === id}
              related={related.has(id)}
              dim={!!selectedId && selectedId !== id && !related.has(id) && false}
              pickable={!!pick && id !== pick.from}
              onSelect={(x) => (pick && x !== pick.from ? useStore.getState().confirmPick(x) : select(x))}
              onEdit={beginEdit}
              onToggle={toggleCollapse}
            />
          );
        })}
        {layout.order.length === 0 && (
          <div className="col-span-full row-start-2 mt-10 text-center text-muted" style={{ gridColumn: "1 / -1" }}>
            <p className="text-[15px] text-fg">This {flow === "pro" ? "Pro" : "Con"} flow is empty.</p>
            <p className="mt-1 text-[13px]">Press <span className="kbd">Enter</span> to add the first contention, or <span className="kbd">/</span> for commands.</p>
          </div>
        )}
      </div>
    </div>
  );
}

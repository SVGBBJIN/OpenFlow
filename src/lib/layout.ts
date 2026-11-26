import type { Arg, ArgMap, Side } from "./types";

export interface Placed {
  id: string;
  col: number;
  row: number;
  depth: number;
  span: number;
  /** Number of descendants hidden by collapse. */
  hidden: number;
  rootStart: boolean;
}

export interface Layout {
  placed: Record<string, Placed>;
  /** Depth-first reading order (used by Tab / Shift+Tab). */
  order: string[];
  rows: number;
}

export function childIndex(args: ArgMap): Map<string, Arg[]> {
  const idx = new Map<string, Arg[]>();
  for (const a of Object.values(args)) {
    const k = a.parentId ?? "";
    const list = idx.get(k);
    if (list) list.push(a);
    else idx.set(k, [a]);
  }
  for (const list of idx.values()) list.sort((a, b) => a.order - b.order);
  return idx;
}

export function countDescendants(idx: Map<string, Arg[]>, id: string): number {
  let n = 0;
  for (const k of idx.get(id) ?? []) n += 1 + countDescendants(idx, k.id);
  return n;
}

/**
 * Lay a flow out on a (column=speech, row) grid. A node's first response shares
 * its row (reads left to right); further responses stack beneath. A child that
 * sits in the same column as its parent starts one row lower.
 */
export function layoutFlow(
  args: ArgMap,
  flow: Side,
  colOf: (speechId: string) => number,
): Layout {
  const idx = childIndex(args);
  const placed: Record<string, Placed> = {};
  const order: string[] = [];
  let row = 0;

  function place(a: Arg, r: number, depth: number, rootStart: boolean): number {
    const col = colOf(a.speechId);
    const kids = a.collapsed ? [] : (idx.get(a.id) ?? []);
    const p: Placed = {
      id: a.id,
      col,
      row: r,
      depth,
      span: 1,
      hidden: a.collapsed ? countDescendants(idx, a.id) : 0,
      rootStart,
    };
    placed[a.id] = p;
    order.push(a.id);
    let used = 0;
    for (const k of kids) {
      if (used === 0 && colOf(k.speechId) <= col) used = 1;
      used += place(k, r + used, depth + 1, false);
    }
    p.span = Math.max(1, used);
    return p.span;
  }

  for (const root of idx.get("") ?? []) {
    if (root.flow !== flow) continue;
    row += place(root, row, 0, true);
  }
  return { placed, order, rows: row };
}

export type Dir = "up" | "down" | "left" | "right";

/** Spatial navigation between placed cells. Returns the id to select, or null. */
export function navigate(
  layout: Layout,
  args: ArgMap,
  fromId: string,
  dir: Dir,
): string | null {
  const cur = layout.placed[fromId];
  if (!cur) return null;
  const all = Object.values(layout.placed);
  if (dir === "up" || dir === "down") {
    const same = all
      .filter((p) => p.col === cur.col && p.id !== fromId)
      .filter((p) => (dir === "up" ? p.row < cur.row : p.row > cur.row))
      .sort((a, b) => (dir === "up" ? b.row - a.row : a.row - b.row));
    return same[0]?.id ?? null;
  }
  if (dir === "left") {
    const parent = args[fromId]?.parentId;
    if (parent && layout.placed[parent] && layout.placed[parent].col < cur.col) return parent;
  }
  const cands = all.filter((p) => (dir === "left" ? p.col < cur.col : p.col > cur.col));
  if (!cands.length) return null;
  const nearestCol = dir === "left" ? Math.max(...cands.map((p) => p.col)) : Math.min(...cands.map((p) => p.col));
  const inCol = cands.filter((p) => p.col === nearestCol);
  if (dir === "right") {
    const kid = inCol.find((p) => args[p.id]?.parentId === fromId);
    if (kid) return kid.id;
  }
  inCol.sort((a, b) => Math.abs(a.row - cur.row) - Math.abs(b.row - cur.row) || a.row - b.row);
  return inCol[0]?.id ?? null;
}

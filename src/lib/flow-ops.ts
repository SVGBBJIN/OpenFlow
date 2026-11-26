import { nanoid } from "nanoid";
import { childIndex } from "./layout";
import type { Arg, ArgMap, Round, Side, Status } from "./types";

export const newId = () => nanoid(10);

export function blankArg(round: Round, over: Partial<Arg> & Pick<Arg, "flow" | "speechId">): Arg {
  const now = Date.now();
  return {
    id: newId(),
    roundId: round.id,
    parentId: null,
    order: 0,
    text: "",
    status: "active",
    priority: 0,
    tags: [],
    notes: "",
    impact: "",
    collapsed: false,
    isTurn: false,
    extendsId: null,
    linkedIds: [],
    evidenceIds: [],
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

function siblings(args: ArgMap, parentId: string | null, flow: Side): Arg[] {
  const list = childIndex(args).get(parentId ?? "") ?? [];
  return parentId ? list : list.filter((a) => a.flow === flow);
}

function orderAfter(sibs: Arg[], afterId: string | null): number {
  if (!sibs.length) return 1;
  if (!afterId) return sibs[sibs.length - 1].order + 1;
  const i = sibs.findIndex((s) => s.id === afterId);
  if (i < 0 || i === sibs.length - 1) return sibs[sibs.length - 1].order + 1;
  return (sibs[i].order + sibs[i + 1].order) / 2;
}

export interface OpResult {
  args: ArgMap;
  /** Id of the node created / affected, if any. */
  id?: string;
}

export function createRoot(args: ArgMap, round: Round, flow: Side, speechId: string, afterId: string | null = null): OpResult {
  const order = orderAfter(siblings(args, null, flow), afterId);
  const a = blankArg(round, { flow, speechId, order });
  return { args: { ...args, [a.id]: a }, id: a.id };
}

/** New argument directly after `id` among its siblings (same parent, same speech). */
export function createSibling(args: ArgMap, round: Round, id: string): OpResult {
  const cur = args[id];
  const order = orderAfter(siblings(args, cur.parentId, cur.flow), id);
  const a = blankArg(round, { flow: cur.flow, speechId: cur.speechId, parentId: cur.parentId, order });
  return { args: { ...args, [a.id]: a }, id: a.id };
}

/** New response to `id`, one speech to the right (clamped), appended after existing responses. */
export function createResponse(
  args: ArgMap,
  round: Round,
  id: string,
  opts: { isTurn?: boolean; extend?: boolean } = {},
): OpResult {
  const cur = args[id];
  const si = round.speeches.findIndex((s) => s.id === cur.speechId);
  const next = round.speeches[Math.min(round.speeches.length - 1, si + 1)];
  const order = orderAfter(siblings(args, id, cur.flow), null);
  const a = blankArg(round, {
    flow: cur.flow,
    speechId: next.id,
    parentId: id,
    order,
    isTurn: !!opts.isTurn,
    extendsId: opts.extend ? id : null,
  });
  return { args: { ...args, [a.id]: a, [id]: cur.collapsed ? { ...cur, collapsed: false } : cur }, id: a.id };
}

export function updateArg(args: ArgMap, id: string, patch: Partial<Arg>): ArgMap {
  const cur = args[id];
  if (!cur) return args;
  return { ...args, [id]: { ...cur, ...patch, updatedAt: Date.now() } };
}

export function subtreeIds(args: ArgMap, id: string): string[] {
  const idx = childIndex(args);
  const out: string[] = [];
  const walk = (x: string) => {
    out.push(x);
    for (const k of idx.get(x) ?? []) walk(k.id);
  };
  walk(id);
  return out;
}

export function deleteSubtree(args: ArgMap, id: string): { args: ArgMap; removed: string[] } {
  const removed = subtreeIds(args, id);
  const gone = new Set(removed);
  const next: ArgMap = {};
  for (const a of Object.values(args)) {
    if (gone.has(a.id)) continue;
    next[a.id] = a.linkedIds.some((l) => gone.has(l))
      ? { ...a, linkedIds: a.linkedIds.filter((l) => !gone.has(l)) }
      : a;
  }
  return { args: next, removed };
}

/** Swap position with previous (-1) / next (+1) sibling. */
export function moveSibling(args: ArgMap, id: string, dir: -1 | 1): ArgMap {
  const cur = args[id];
  const sibs = siblings(args, cur.parentId, cur.flow);
  const i = sibs.findIndex((s) => s.id === id);
  const j = i + dir;
  if (j < 0 || j >= sibs.length) return args;
  const other = sibs[j];
  return {
    ...args,
    [id]: { ...cur, order: other.order, updatedAt: Date.now() },
    [other.id]: { ...other, order: cur.order },
  };
}

/** Make sure every descendant sits in a speech column >= its parent's. */
function fixColumns(args: ArgMap, rootId: string, colOf: (s: string) => number, speechAt: (i: number) => string): ArgMap {
  const idx = childIndex(args);
  let out = args;
  const walk = (id: string) => {
    const p = out[id];
    for (const k of idx.get(id) ?? []) {
      if (colOf(out[k.id].speechId) < colOf(p.speechId)) out = { ...out, [k.id]: { ...out[k.id], speechId: speechAt(colOf(p.speechId)) } };
      walk(k.id);
    }
  };
  walk(rootId);
  return out;
}

/** Move a node (and keep its relationships) to another speech column. */
export function setSpeech(args: ArgMap, round: Round, id: string, speechIdx: number): ArgMap {
  const colOf = (s: string) => round.speeches.findIndex((x) => x.id === s);
  const cur = args[id];
  let idx = Math.max(0, Math.min(round.speeches.length - 1, speechIdx));
  if (cur.parentId) idx = Math.max(idx, colOf(args[cur.parentId].speechId));
  const next = { ...args, [id]: { ...cur, speechId: round.speeches[idx].id, updatedAt: Date.now() } };
  return fixColumns(next, id, colOf, (i) => round.speeches[i].id);
}

/** Re-parent a subtree. Returns null if it would create a cycle. */
export function reparent(args: ArgMap, round: Round, id: string, newParentId: string | null): ArgMap | null {
  if (newParentId === id) return null;
  if (newParentId && subtreeIds(args, id).includes(newParentId)) return null;
  const cur = args[id];
  const flow = newParentId ? args[newParentId].flow : cur.flow;
  const sibs = siblings(args, newParentId, flow).filter((s) => s.id !== id);
  const order = sibs.length ? sibs[sibs.length - 1].order + 1 : 1;
  const ids = subtreeIds(args, id);
  const next = { ...args };
  for (const x of ids) next[x] = { ...next[x], flow, updatedAt: Date.now() };
  next[id] = { ...next[id], parentId: newParentId, order, extendsId: next[id].extendsId === cur.parentId ? null : next[id].extendsId };
  const colOf = (s: string) => round.speeches.findIndex((x) => x.id === s);
  if (newParentId) {
    const pc = colOf(next[newParentId].speechId);
    if (colOf(next[id].speechId) < pc) next[id] = { ...next[id], speechId: round.speeches[pc].id };
  }
  return fixColumns(next, id, colOf, (i) => round.speeches[i].id);
}

export function toggleLink(args: ArgMap, a: string, b: string): ArgMap {
  if (a === b) return args;
  const A = args[a];
  const B = args[b];
  const linked = A.linkedIds.includes(b);
  return {
    ...args,
    [a]: { ...A, linkedIds: linked ? A.linkedIds.filter((x) => x !== b) : [...A.linkedIds, b] },
    [b]: { ...B, linkedIds: linked ? B.linkedIds.filter((x) => x !== a) : [...B.linkedIds, a] },
  };
}

export function setStatus(args: ArgMap, id: string, status: Status): ArgMap {
  return updateArg(args, id, { status });
}

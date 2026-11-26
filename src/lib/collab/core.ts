import * as Y from "yjs";
import type { Arg, ArgMap, Round } from "../types";

/** Transaction origins. Only LOCAL changes are tracked by the undo manager. */
export const LOCAL = "local";
export const LOCAL_TEXT = "local-text";

export const ARG_FIELDS = [
  "flow", "speechId", "parentId", "order", "text", "status", "priority", "tags", "notes", "impact",
  "collapsed", "isTurn", "extendsId", "linkedIds", "evidenceIds", "inserts", "createdAt", "updatedAt",
] as const;
type ArgField = (typeof ARG_FIELDS)[number];

export const ROUND_FIELDS = ["title", "tournament", "opponent", "partner", "side", "speeches", "plans", "review", "completed"] as const;
type RoundField = (typeof ROUND_FIELDS)[number];

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export const argsMap = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>("args");
export const roundMap = (doc: Y.Doc) => doc.getMap<unknown>("round");

function argToY(a: Arg): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  for (const f of ARG_FIELDS) m.set(f, a[f as ArgField]);
  return m;
}

export function yToArg(id: string, roundId: string, m: Y.Map<unknown>): Arg {
  const g = <T,>(k: ArgField, d: T) => (m.has(k) ? (m.get(k) as T) : d);
  return {
    id, roundId, flow: g("flow", "pro"), speechId: g("speechId", ""), parentId: g("parentId", null), order: g("order", 0),
    text: g("text", ""), status: g("status", "active"), priority: g("priority", 0), tags: g("tags", []), notes: g("notes", ""),
    impact: g("impact", ""), collapsed: g("collapsed", false), isTurn: g("isTurn", false), extendsId: g("extendsId", null),
    linkedIds: g("linkedIds", []), evidenceIds: g("evidenceIds", []), inserts: g("inserts", []),
    createdAt: g("createdAt", 0), updatedAt: g("updatedAt", 0),
  };
}

export function readArgs(doc: Y.Doc, roundId: string): ArgMap {
  const out: ArgMap = {};
  argsMap(doc).forEach((m, id) => { out[id] = yToArg(id, roundId, m); });
  return out;
}

/** Mirror a local ArgMap change into the shared doc, writing only what changed (field-level merge). */
export function applyArgsDiff(doc: Y.Doc, prev: ArgMap, next: ArgMap) {
  const map = argsMap(doc);
  doc.transact(() => {
    for (const id of Object.keys(prev)) if (!next[id]) map.delete(id);
    for (const [id, a] of Object.entries(next)) {
      const p = prev[id];
      if (p === a) continue;
      const m = map.get(id);
      if (!p || !m) { map.set(id, argToY(a)); continue; }
      for (const f of ARG_FIELDS) if (f !== "text" && !same(p[f as ArgField], a[f as ArgField])) m.set(f, a[f as ArgField]);
    }
  }, LOCAL);
  // Text snapshots are written under a separate origin so structural undo never rewinds typing.
  doc.transact(() => {
    for (const [id, a] of Object.entries(next)) {
      const p = prev[id], m = map.get(id);
      if (p && m && p !== a && p.text !== a.text) m.set("text", a.text);
    }
  }, LOCAL_TEXT);
}

export function applyRoundDiff(doc: Y.Doc, prev: Round | null, next: Round) {
  const m = roundMap(doc);
  doc.transact(() => {
    for (const f of ROUND_FIELDS) {
      const v = next[f as RoundField];
      if (!prev || !same(prev[f as RoundField], v)) { if (v === undefined) m.delete(f); else m.set(f, v); }
    }
  }, LOCAL);
}

export function readRound(doc: Y.Doc, base: Round): Round {
  const m = roundMap(doc);
  const r: Record<string, unknown> = { ...base };
  for (const f of ROUND_FIELDS) if (m.has(f)) r[f] = m.get(f);
  return r as unknown as Round;
}

export const seedDoc = (doc: Y.Doc, round: Round, args: ArgMap) => {
  applyRoundDiff(doc, null, round);
  applyArgsDiff(doc, {}, args);
  // seeding includes text for new args (argToY covers it)
};

/* ───────────── wire protocol ───────────── */

export type Msg =
  | { t: "sync-req"; from: number; sv: string }
  | { t: "update"; from: number; u: string }
  | { t: "aw"; from: number; u: string };

export interface Transport {
  send(m: Msg): void;
  onMessage(cb: (m: Msg) => void): void;
  close(): void;
}

export const toB64 = (u: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
export const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

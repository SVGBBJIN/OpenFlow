import { del, get, set } from "idb-keyval";
import { newId } from "./flow-ops";
import type { ArgMap, Round } from "./types";

export interface Version { id: string; at: number; label: string; auto: boolean; round: Round; args: ArgMap }
const key = (id: string) => `openflow:versions:${id}`;
const MAX = 60;

export async function listVersions(roundId: string): Promise<Version[]> {
  return ((await get<Version[]>(key(roundId))) ?? []).sort((a, b) => b.at - a.at);
}
export async function saveVersion(round: Round, args: ArgMap, label: string, auto = false): Promise<Version> {
  const v: Version = { id: newId(), at: Date.now(), label, auto, round: { ...round }, args: { ...args } };
  let list = await listVersions(round.id);
  list = [v, ...list];
  // Keep every manual version; thin out old automatic ones.
  const autos = list.filter((x) => x.auto);
  if (list.length > MAX) { const drop = new Set(autos.slice(Math.max(0, MAX - list.filter((x) => !x.auto).length)).map((x) => x.id)); list = list.filter((x) => !drop.has(x.id)); }
  await set(key(round.id), list);
  return v;
}
export async function deleteVersion(roundId: string, id: string) {
  await set(key(roundId), (await listVersions(roundId)).filter((v) => v.id !== id));
}
export const clearVersions = (roundId: string) => del(key(roundId));

/** Counts for a quick, deterministic comparison of two states. */
export function diffSummary(a: ArgMap, b: ArgMap) {
  let added = 0, removed = 0, changed = 0;
  for (const id of Object.keys(b)) { if (!a[id]) added++; else if (JSON.stringify({ ...a[id], updatedAt: 0 }) !== JSON.stringify({ ...b[id], updatedAt: 0 })) changed++; }
  for (const id of Object.keys(a)) if (!b[id]) removed++;
  return { added, removed, changed };
}

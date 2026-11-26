import { del, get, set } from "idb-keyval";
import type { ArgMap, Round } from "./types";

const IDX = "openflow:rounds";
const argsKey = (id: string) => `openflow:args:${id}`;

export async function loadRounds(): Promise<Round[]> {
  try {
    return ((await get<Round[]>(IDX)) ?? []) as Round[];
  } catch {
    return [];
  }
}
export const saveRounds = (rounds: Round[]) => set(IDX, rounds);
export async function loadArgs(roundId: string): Promise<ArgMap> {
  return ((await get<ArgMap>(argsKey(roundId))) ?? {}) as ArgMap;
}
export const saveArgs = (roundId: string, args: ArgMap) => set(argsKey(roundId), args);
export const deleteArgs = (roundId: string) => del(argsKey(roundId));

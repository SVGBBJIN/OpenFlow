"use client";
import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import type { SpeechDoc } from "./prep";
import { useStore } from "./store";

const KEY = "openflow:docs";
let timer: ReturnType<typeof setTimeout> | null = null;

interface D {
  ready: boolean;
  docs: Record<string, SpeechDoc>;
  load(): Promise<void>;
  put(d: SpeechDoc): void;
  remove(id: string): void;
}
export const useDocs = create<D>((set, get) => {
  const save = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void idbSet(KEY, Object.values(get().docs)), 300); };
  return {
    ready: false, docs: {},
    async load() {
      if (get().ready) return;
      const list = (await idbGet<SpeechDoc[]>(KEY)) ?? [];
      set((st) => ({ docs: { ...Object.fromEntries(list.map((d) => [d.id, d])), ...st.docs }, ready: true }));
    },
    put(d) { set((s) => ({ docs: { ...s.docs, [d.id]: { ...d, updatedAt: Date.now() } } })); save(); },
    remove(id) {
      const d = get().docs[id]; if (!d) return;
      set((s) => { const docs = { ...s.docs }; delete docs[id]; return { docs }; }); save();
      useStore.getState().toast(`Deleted “${d.title}”`, () => get().put(d));
    },
  };
});

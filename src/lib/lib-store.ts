"use client";
import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { newId } from "./flow-ops";
import { blankBlock, blankCard, descendantsOf, type Block, type EvidenceCard, type Folder, type LibraryData, type Scope } from "./library";
import { useStore } from "./store";

const KEY = "openflow:library";
let timer: ReturnType<typeof setTimeout> | null = null;

interface L {
  ready: boolean;
  cards: Record<string, EvidenceCard>;
  folders: Folder[];
  blocks: Record<string, Block>;
  load(): Promise<void>;
  addCard(p?: Partial<EvidenceCard>): string;
  addCards(ps: Partial<EvidenceCard>[]): string[];
  updateCard(id: string, p: Partial<EvidenceCard>): void;
  deleteCards(ids: string[]): void;
  moveCards(ids: string[], folderId: string | null): void;
  addFolder(scope: Scope, name: string, parentId: string | null, kind?: "folder" | "file"): string;
  renameFolder(id: string, name: string): void;
  deleteFolder(id: string): void;
  addBlock(p?: Partial<Block>): string;
  updateBlock(id: string, p: Partial<Block>): void;
  deleteBlock(id: string): void;
  moveBlocks(ids: string[], folderId: string | null): void;
  snapshot(): LibraryData;
  replaceAll(d: LibraryData): void;
}

export const useLib = create<L>((set, get) => {
  const save = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void idbSet(KEY, get().snapshot()); }, 300);
  };
  const upd = (fn: (s: L) => Partial<L>) => { set(fn); save(); };
  const toast = (m: string, undo?: () => void) => useStore.getState().toast(m, undo);

  return {
    ready: false, cards: {}, folders: [], blocks: {},
    async load() {
      if (get().ready) return;
      const d = (await idbGet<LibraryData>(KEY)) ?? { cards: [], folders: [], blocks: [] };
      set((st) => ({ cards: { ...Object.fromEntries(d.cards.map((c) => [c.id, c])), ...st.cards }, folders: [...d.folders, ...st.folders.filter((f) => !d.folders.some((x) => x.id === f.id))], blocks: { ...Object.fromEntries(d.blocks.map((b) => [b.id, b])), ...st.blocks }, ready: true }));
    },
    snapshot: () => ({ cards: Object.values(get().cards), folders: get().folders, blocks: Object.values(get().blocks) }),
    replaceAll(d) { upd(() => ({ cards: Object.fromEntries(d.cards.map((c) => [c.id, c])), folders: d.folders, blocks: Object.fromEntries(d.blocks.map((b) => [b.id, b])) })); },

    addCard(p = {}) { const c = blankCard(p); upd((s) => ({ cards: { ...s.cards, [c.id]: c } })); return c.id; },
    addCards(ps) {
      const cs = ps.map((p) => blankCard(p));
      upd((s) => ({ cards: { ...s.cards, ...Object.fromEntries(cs.map((c) => [c.id, c])) } }));
      return cs.map((c) => c.id);
    },
    updateCard(id, p) { const c = get().cards[id]; if (c) upd((s) => ({ cards: { ...s.cards, [id]: { ...c, ...p, updatedAt: Date.now() } } })); },
    deleteCards(ids) {
      const removed = ids.map((i) => get().cards[i]).filter(Boolean);
      upd((s) => { const cards = { ...s.cards }; ids.forEach((i) => delete cards[i]); return { cards }; });
      toast(`Deleted ${removed.length} card${removed.length === 1 ? "" : "s"}`, () => upd((s) => ({ cards: { ...s.cards, ...Object.fromEntries(removed.map((c) => [c.id, c])) } })));
    },
    moveCards(ids, folderId) { upd((s) => { const cards = { ...s.cards }; ids.forEach((i) => cards[i] && (cards[i] = { ...cards[i], folderId, updatedAt: Date.now() })); return { cards }; }); },

    addFolder(scope, name, parentId, kind = "folder") { const f: Folder = { id: newId(), scope, name, parentId, kind }; upd((s) => ({ folders: [...s.folders, f] })); return f.id; },
    renameFolder(id, name) { upd((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)) })); },
    deleteFolder(id) {
      // Contents move up one level; nothing is lost.
      const f = get().folders.find((x) => x.id === id); if (!f) return;
      const before = get().snapshot();
      upd((s) => ({
        folders: s.folders.filter((x) => x.id !== id).map((x) => (x.parentId === id ? { ...x, parentId: f.parentId } : x)),
        cards: Object.fromEntries(Object.values(s.cards).map((c) => [c.id, c.folderId === id ? { ...c, folderId: f.parentId } : c])),
        blocks: Object.fromEntries(Object.values(s.blocks).map((b) => [b.id, b.folderId === id ? { ...b, folderId: f.parentId } : b])),
      }));
      toast(`Deleted “${f.name}” (contents kept)`, () => get().replaceAll(before));
    },

    addBlock(p = {}) { const b = blankBlock(p); upd((s) => ({ blocks: { ...s.blocks, [b.id]: b } })); return b.id; },
    updateBlock(id, p) { const b = get().blocks[id]; if (b) upd((s) => ({ blocks: { ...s.blocks, [id]: { ...b, ...p, updatedAt: Date.now() } } })); },
    deleteBlock(id) {
      const b = get().blocks[id]; if (!b) return;
      upd((s) => { const blocks = { ...s.blocks }; delete blocks[id]; return { blocks }; });
      toast(`Deleted block /${b.name}`, () => upd((s) => ({ blocks: { ...s.blocks, [id]: b } })));
    },
    moveBlocks(ids, folderId) { upd((s) => { const blocks = { ...s.blocks }; ids.forEach((i) => blocks[i] && (blocks[i] = { ...blocks[i], folderId })); return { blocks }; }); },
  };
});

export { descendantsOf };

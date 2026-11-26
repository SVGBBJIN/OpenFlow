"use client";
import { create } from "zustand";
import * as ops from "./flow-ops";
import { layoutFlow, navigate, type Dir } from "./layout";
import { isEmptyHtml } from "./sanitize";
import { deleteArgs, loadArgs, loadRounds, saveArgs, saveRounds } from "./storage";
import { DEFAULT_KEYMAP, loadKeymap, saveKeymap, type Keymap } from "./keymap";
import { childIndex } from "./layout";
import { PF_SPEECHES, type Arg, type ArgMap, type Round, type Side, type Status } from "./types";

export interface Toast { id: string; msg: string; undo?: () => void }
export interface PickMode { kind: "link" | "reparent"; from: string }
type SaveState = "saved" | "saving" | "error";

interface S {
  ready: boolean;
  rounds: Record<string, Round>;
  currentId: string | null;
  args: ArgMap;
  past: ArgMap[];
  future: ArgMap[];
  flow: Side;
  selectedId: string | null;
  editingId: string | null;
  editSeed: string | null;
  editBase: ArgMap | null;
  lastCreated: string | null;
  pick: PickMode | null;
  saveState: SaveState;
  toasts: Toast[];
  keymap: Keymap;
  paletteOpen: boolean;

  init(): Promise<void>;
  createRound(o: { title?: string; side?: Side; opponent?: string; partner?: string; tournament?: string }): string;
  updateRound(id: string, patch: Partial<Round>): void;
  trashRound(id: string): void;
  restoreRound(id: string): void;
  purgeRound(id: string): void;
  openRound(id: string): Promise<void>;
  setFlow(f: Side): void;
  select(id: string | null): void;
  beginEdit(id: string, seed?: string | null): void;
  endEdit(): void;
  setText(id: string, html: string): void;
  patchArg(id: string, patch: Partial<Arg>): void;
  setStatus(id: string, s: Status): void;
  step(dir: 1 | -1, edit: boolean): void;
  navigateDir(dir: Dir): void;
  newContention(): void;
  newSibling(): void;
  newResponse(o?: { isTurn?: boolean; extend?: boolean }): void;
  deleteSelected(): void;
  move(dir: -1 | 1): void;
  shiftColumn(dir: -1 | 1): void;
  toggleCollapse(id?: string): void;
  detach(id: string): void;
  unlink(a: string, b: string): void;
  setPick(p: PickMode | null): void;
  confirmPick(targetId: string): void;
  undo(): void;
  redo(): void;
  toast(msg: string, undo?: () => void): void;
  dismissToast(id: string): void;
  setKeymap(k: Keymap): void;
  setPalette(open: boolean): void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const rnd = () => Math.random().toString(36).slice(2, 9);

export const useStore = create<S>((set, get) => {
  const round = () => {
    const { currentId, rounds } = get();
    return currentId ? rounds[currentId] : null;
  };

  const flush = async () => {
    const { rounds, currentId, args } = get();
    try {
      await saveRounds(Object.values(rounds));
      if (currentId) await saveArgs(currentId, args);
      if (!saveTimer) set({ saveState: "saved" });
    } catch {
      set({ saveState: "error" });
    }
  };
  const scheduleSave = () => {
    set({ saveState: "saving" });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void flush();
    }, 400);
  };
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      if (saveTimer) void flush();
    });
  }

  /** Apply a structural change, recording one undo step. */
  const commit = (next: ArgMap, opts: { history?: boolean } = {}) => {
    const s = get();
    if (next === s.args) return;
    const r = round();
    set({
      args: next,
      past: opts.history === false ? s.past : [...s.past.slice(-199), s.args],
      future: opts.history === false ? s.future : [],
      rounds: r ? { ...s.rounds, [r.id]: { ...r, updatedAt: Date.now() } } : s.rounds,
    });
    scheduleSave();
  };

  const startEditing = (id: string, seed: string | null = null) => {
    set({ selectedId: id, editingId: id, editSeed: seed, editBase: get().args });
  };

  return {
    ready: false, rounds: {}, currentId: null, args: {}, past: [], future: [],
    flow: "pro", selectedId: null, editingId: null, editSeed: null, editBase: null,
    lastCreated: null, pick: null, saveState: "saved", toasts: [], keymap: DEFAULT_KEYMAP, paletteOpen: false,

    async init() {
      if (get().ready) return;
      const list = await loadRounds();
      set((st) => ({ rounds: { ...Object.fromEntries(list.map((r) => [r.id, r])), ...st.rounds }, ready: true, keymap: loadKeymap() }));
    },

    createRound(o) {
      const now = Date.now();
      const id = ops.newId();
      const r: Round = {
        id, title: o.title?.trim() || "Untitled round", tournament: o.tournament ?? "",
        side: o.side ?? "pro", opponent: o.opponent ?? "", partner: o.partner ?? "",
        speeches: PF_SPEECHES.map((s) => ({ ...s, id: ops.newId() })),
        createdAt: now, updatedAt: now, deletedAt: null,
      };
      set((s) => ({ rounds: { ...s.rounds, [id]: r } }));
      void saveRounds(Object.values(get().rounds));
      return id;
    },
    updateRound(id, patch) {
      set((s) => ({ rounds: { ...s.rounds, [id]: { ...s.rounds[id], ...patch, updatedAt: Date.now() } } }));
      scheduleSave();
    },
    trashRound(id) {
      get().updateRound(id, { deletedAt: Date.now() });
      get().toast("Round moved to trash", () => get().restoreRound(id));
    },
    restoreRound(id) { get().updateRound(id, { deletedAt: null }); },
    purgeRound(id) {
      set((s) => {
        const { [id]: _gone, ...rest } = s.rounds;
        void _gone;
        return { rounds: rest };
      });
      void deleteArgs(id);
      void saveRounds(Object.values(get().rounds));
    },

    async openRound(id) {
      if (get().currentId === id) return;
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; await flush(); }
      const args = Object.fromEntries(Object.entries(await loadArgs(id)).map(([k, a]) => [k, normalizeArg(a)]));
      const r = get().rounds[id];
      const first = layoutFlow(args, r?.side ?? "pro", (sid) => r?.speeches.findIndex((s) => s.id === sid) ?? 0).order[0] ?? null;
      set({ currentId: id, args, past: [], future: [], flow: r?.side ?? "pro", selectedId: first, editingId: null, pick: null, lastCreated: null, saveState: "saved" });
    },

    setFlow(f) {
      const r = round(); if (!r) return;
      const L = layoutFlow(get().args, f, (sid) => r.speeches.findIndex((s) => s.id === sid));
      set({ flow: f, selectedId: L.order[0] ?? null, editingId: null });
    },
    select(id) { set({ selectedId: id }); },
    beginEdit(id, seed) { startEditing(id, seed ?? null); },

    endEdit() {
      const { editingId, args, editBase, lastCreated } = get();
      if (!editingId) return;
      const a = args[editingId];
      set({ editingId: null, editSeed: null, editBase: null });
      if (!a) return;
      const hasKids = (childIndex(args).get(a.id) ?? []).length > 0;
      if (isEmptyHtml(a.text) && !hasKids) {
        // Discard an abandoned blank cell without leaving junk behind.
        const { args: next } = ops.deleteSubtree(args, a.id);
        const s = get();
        const parent = a.parentId && next[a.parentId] ? a.parentId : null;
        set({
          args: next, selectedId: parent,
          past: lastCreated === a.id ? s.past.slice(0, -1) : s.past,
        });
        scheduleSave();
        return;
      }
      if (editBase && lastCreated !== a.id && editBase[a.id]?.text !== a.text) {
        set((s) => ({ past: [...s.past.slice(-199), editBase], future: [] }));
      }
    },

    setText(id, html) {
      const a = get().args[id]; if (!a || a.text === html) return;
      commit(ops.updateArg(get().args, id, { text: html }), { history: false });
    },
    patchArg(id, patch) { commit(ops.updateArg(get().args, id, patch)); },
    setStatus(id, s) { commit(ops.setStatus(get().args, id, s)); },

    step(dir, edit) {
      const r = round(); if (!r) return;
      const { selectedId, flow } = get();
      const colOf = (sid: string) => r.speeches.findIndex((s) => s.id === sid);
      if (edit) get().endEdit();
      const L = layoutFlow(get().args, flow, colOf);
      const i = selectedId ? L.order.indexOf(selectedId) : -1;
      const nxt = i < 0 && selectedId ? undefined : L.order[i + dir];
      if (!nxt) return;
      if (edit) startEditing(nxt); else set({ selectedId: nxt });
    },
    navigateDir(dir) {
      const r = round(); if (!r) return;
      const { selectedId, flow, args } = get();
      const L = layoutFlow(args, flow, (sid) => r.speeches.findIndex((s) => s.id === sid));
      if (!selectedId || !L.placed[selectedId]) { set({ selectedId: L.order[0] ?? null }); return; }
      const t = navigate(L, args, selectedId, dir);
      if (t) set({ selectedId: t });
    },
    newContention() {
      const r = round(); if (!r) return;
      const { flow, args, selectedId } = get();
      const root = selectedId ? rootOf(args, selectedId) : null;
      const col = Math.max(0, r.speeches.findIndex((s) => s.side === flow));
      const res = ops.createRoot(args, r, flow, r.speeches[col].id, root);
      commit(res.args);
      set({ lastCreated: res.id! });
      startEditing(res.id!);
    },
    newSibling() {
      const r = round(); const { selectedId, args } = get();
      if (!r) return;
      if (!selectedId || !args[selectedId]) return get().newContention();
      const res = ops.createSibling(args, r, selectedId);
      commit(res.args);
      set({ lastCreated: res.id! });
      startEditing(res.id!);
    },
    newResponse(o) {
      const r = round(); const { selectedId, args } = get();
      if (!r || !selectedId || !args[selectedId]) return;
      const res = ops.createResponse(args, r, selectedId, o);
      commit(res.args);
      set({ lastCreated: res.id! });
      startEditing(res.id!);
    },

    deleteSelected() {
      const { selectedId, args, flow } = get(); const r = round();
      if (!selectedId || !args[selectedId] || !r) return;
      const L = layoutFlow(args, flow, (sid) => r.speeches.findIndex((s) => s.id === sid));
      const i = L.order.indexOf(selectedId);
      const { args: next, removed } = ops.deleteSubtree(args, selectedId);
      const L2 = layoutFlow(next, flow, (sid) => r.speeches.findIndex((s) => s.id === sid));
      const fallback = args[selectedId].parentId && next[args[selectedId].parentId!] ? args[selectedId].parentId : (L2.order[Math.min(i, L2.order.length - 1)] ?? null);
      commit(next);
      set({ selectedId: fallback, editingId: null });
      get().toast(`Deleted ${removed.length} argument${removed.length > 1 ? "s" : ""}`, () => get().undo());
    },

    move(dir) {
      const id = get().selectedId; if (!id) return;
      commit(ops.moveSibling(get().args, id, dir));
    },
    shiftColumn(dir) {
      const r = round(); const id = get().selectedId; if (!r || !id) return;
      const cur = r.speeches.findIndex((s) => s.id === get().args[id].speechId);
      commit(ops.setSpeech(get().args, r, id, cur + dir));
    },
    toggleCollapse(id) {
      const t = id ?? get().selectedId; if (!t || !get().args[t]) return;
      commit(ops.updateArg(get().args, t, { collapsed: !get().args[t].collapsed }), { history: false });
    },

    detach(id) {
      const r = round(); if (!r) return;
      const next = ops.reparent(get().args, r, id, null);
      if (next) commit(next);
    },
    unlink(a, b) { commit(ops.toggleLink(get().args, a, b)); },
    setPick(p) { set({ pick: p }); },
    confirmPick(target) {
      const { pick, args } = get(); const r = round();
      if (!pick || !r) return;
      if (pick.kind === "link") {
        if (target === pick.from) return get().toast("Pick a different argument");
        commit(ops.toggleLink(args, pick.from, target));
      } else {
        const next = ops.reparent(args, r, pick.from, target);
        if (!next) return get().toast("Can't move an argument under itself");
        commit(next);
      }
      set({ pick: null, selectedId: pick.from });
    },

    undo() {
      const s = get(); if (!s.past.length) return;
      const prev = s.past[s.past.length - 1];
      set({
        args: prev, past: s.past.slice(0, -1), future: [s.args, ...s.future].slice(0, 200),
        selectedId: s.selectedId && prev[s.selectedId] ? s.selectedId : (Object.keys(prev)[0] ?? null),
        editingId: null,
      });
      scheduleSave();
    },
    redo() {
      const s = get(); if (!s.future.length) return;
      const [next, ...rest] = s.future;
      set({
        args: next, past: [...s.past, s.args], future: rest,
        selectedId: s.selectedId && next[s.selectedId] ? s.selectedId : (Object.keys(next)[0] ?? null),
        editingId: null,
      });
      scheduleSave();
    },

    toast(msg, undo) {
      const id = rnd();
      set((s) => ({ toasts: [...s.toasts, { id, msg, undo }] }));
      setTimeout(() => get().dismissToast(id), 6000);
    },
    dismissToast(id) { set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })); },
    setKeymap(k) { saveKeymap(k); set({ keymap: k }); },
    setPalette(open) { set({ paletteOpen: open }); },
  };
});

function rootOf(args: ArgMap, id: string): string {
  let cur = args[id];
  while (cur?.parentId && args[cur.parentId]) cur = args[cur.parentId];
  return cur?.id ?? id;
}

/** Fill fields added in later phases so older saved flows keep loading. */
export function normalizeArg(a: Arg): Arg {
  return { ...a, inserts: a.inserts ?? [], evidenceIds: a.evidenceIds ?? [], linkedIds: a.linkedIds ?? [], tags: a.tags ?? [] };
}

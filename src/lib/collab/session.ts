"use client";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { create } from "zustand";
import { LOCAL, LOCAL_TEXT, applyArgsDiff, applyRoundDiff, argsMap, readArgs, readRound, roundMap, seedDoc, type Transport } from "./core";
import { BroadcastTransport, CollabProvider } from "./provider";
import { useStore } from "../store";
import type { Arg, ArgMap } from "../types";

export type Role = "owner" | "editor" | "viewer";
export type TransportKind = "broadcast" | "supabase";
export interface LiveConfig { roundId: string; transport: TransportKind; role: Role }
export interface Peer { clientId: number; name: string; color: string; selectedId: string | null; editingId: string | null; flow: string | null; self: boolean }

interface C {
  config: LiveConfig | null;
  status: "off" | "connecting" | "live";
  peers: Peer[];
  start(c: LiveConfig): void;
  stop(): void;
  setPeers(p: Peer[]): void;
  setStatus(s: C["status"]): void;
}
export const useCollab = create<C>((set) => ({
  config: null, status: "off", peers: [],
  start: (config) => set({ config }),
  stop: () => set({ config: null, status: "off", peers: [] }),
  setPeers: (peers) => set({ peers }),
  setStatus: (status) => set({ status }),
}));

const COLORS = ["#5eb6ff", "#f0a35e", "#4ec58a", "#b58cf5", "#ef6b73", "#e6c14f", "#4fc3d9", "#f08fc0"];
export function localIdentity() {
  try {
    let name = localStorage.getItem("openflow:name");
    if (!name) { name = `Debater ${Math.floor(1000 + Math.random() * 9000)}`; localStorage.setItem("openflow:name", name); }
    let ci = Number(localStorage.getItem("openflow:color") ?? NaN);
    if (!Number.isInteger(ci)) { ci = Math.floor(Math.random() * COLORS.length); localStorage.setItem("openflow:color", String(ci)); }
    return { name, color: COLORS[ci % COLORS.length] };
  } catch { return { name: "Debater", color: COLORS[0] }; }
}

export interface Session {
  doc: Y.Doc;
  awareness: Awareness;
  role: Role;
  canWrite: boolean;
  fragment(argId: string): Y.XmlFragment;
  /** True when another connected user is editing this cell right now. */
  othersEditing(argId: string): boolean;
  destroy(): void;
}
let current: Session | null = null;
export const getSession = () => current;

const shallowSame = (a: Arg, b: Arg) => (Object.keys(a) as (keyof Arg)[]).every((k) => a[k] === b[k] || JSON.stringify(a[k]) === JSON.stringify(b[k]));

/** Start a live session for the round currently open in the store. */
export function startSession(cfg: LiveConfig, transport: Transport): Session {
  const store = useStore;
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const canWrite = cfg.role !== "viewer";
  const provider = new CollabProvider(doc, awareness, transport, canWrite);
  const um = new Y.UndoManager([argsMap(doc), roundMap(doc)], { trackedOrigins: new Set([LOCAL]), captureTimeout: 400 });
  let mirror: ArgMap = store.getState().args;
  let mirrorRound = store.getState().rounds[cfg.roundId] ?? null;
  const recent = new Map<string, number>();
  let destroyed = false;

  store.setState({ readOnly: !canWrite });

  /* store → doc */
  const unsub = store.subscribe((s) => {
    if (destroyed || !canWrite || s.currentId !== cfg.roundId) return;
    if (s.args !== mirror) {
      for (const [id, a] of Object.entries(s.args)) { const p = mirror[id]; if (p && p !== a) for (const k of Object.keys(a) as (keyof Arg)[]) if (k !== "updatedAt" && JSON.stringify(p[k]) !== JSON.stringify(a[k])) recent.set(`${id}:${k}`, Date.now()); }
      applyArgsDiff(doc, mirror, s.args);
      mirror = s.args;
    }
    const r = s.rounds[cfg.roundId];
    if (r && r !== mirrorRound) { applyRoundDiff(doc, mirrorRound, r); mirrorRound = r; }
  });

  /* doc → store */
  const pull = () => {
    if (destroyed) return;
    const fresh = readArgs(doc, cfg.roundId);
    const next: ArgMap = {};
    for (const [id, a] of Object.entries(fresh)) next[id] = mirror[id] && shallowSame(mirror[id], a) ? mirror[id] : a;
    // Tell the user when a peer's change replaced one they made a moment ago.
    for (const [id, a] of Object.entries(next)) {
      const p = mirror[id]; if (!p || p === a) continue;
      for (const k of Object.keys(a) as (keyof Arg)[]) {
        const t = recent.get(`${id}:${k}`);
        if (k !== "updatedAt" && k !== "text" && t && Date.now() - t < 5000 && JSON.stringify(p[k]) !== JSON.stringify(a[k])) {
          store.getState().toast(`A partner changed “${k}” on an argument you just edited — kept the latest change.`); recent.delete(`${id}:${k}`);
        }
      }
    }
    const same = Object.keys(next).length === Object.keys(mirror).length && Object.keys(next).every((k) => next[k] === mirror[k]);
    if (!same) {
      mirror = next;
      const sel = store.getState().selectedId;
      store.setState({ args: next, selectedId: sel && next[sel] ? sel : null, editingId: store.getState().editingId && next[store.getState().editingId!] ? store.getState().editingId : null });
    }
    const base = store.getState().rounds[cfg.roundId];
    if (base && roundMap(doc).size > 0) {
      const r = readRound(doc, base);
      if (JSON.stringify(r) !== JSON.stringify(base)) { mirrorRound = r; store.setState((s) => ({ rounds: { ...s.rounds, [cfg.roundId]: r } })); }
    }
  };
  const onDeep = (_e: unknown, tr: Y.Transaction) => { if (tr.origin !== LOCAL && tr.origin !== LOCAL_TEXT) queueMicrotask(pull); };
  argsMap(doc).observeDeep(onDeep as never);
  roundMap(doc).observe(onDeep as never);

  /* presence */
  const id = localIdentity();
  const publish = () => {
    const s = store.getState();
    awareness.setLocalState({ user: id, selectedId: s.selectedId, editingId: s.editingId, flow: s.flow });
  };
  publish();
  const unsubPresence = store.subscribe((s, p) => { if (s.selectedId !== p.selectedId || s.editingId !== p.editingId || s.flow !== p.flow) publish(); });
  const onAw = () => {
    const peers: Peer[] = [];
    awareness.getStates().forEach((st, clientId) => {
      const u = (st as { user?: { name: string; color: string } }).user; if (!u) return;
      const x = st as { selectedId: string | null; editingId: string | null; flow: string | null };
      peers.push({ clientId, name: u.name, color: u.color, selectedId: x.selectedId ?? null, editingId: x.editingId ?? null, flow: x.flow ?? null, self: clientId === doc.clientID });
    });
    useCollab.getState().setPeers(peers);
  };
  awareness.on("change", onAw);
  onAw();

  /* undo/redo operate on this user's own changes only */
  store.setState({ collabUndo: { undo: () => um.undo(), redo: () => um.redo() } });

  provider.start();
  useCollab.getState().setStatus("connecting");
  // Joiners adopt shared state; the owner seeds the doc only if nobody answered.
  const seedTimer = setTimeout(() => {
    if (destroyed) return;
    if (argsMap(doc).size === 0 && roundMap(doc).size === 0 && cfg.role === "owner") {
      const s = store.getState();
      const r = s.rounds[cfg.roundId];
      if (r) seedDoc(doc, r, s.args);
    } else pull();
    useCollab.getState().setStatus("live");
  }, 700);

  const session: Session = {
    doc, awareness, role: cfg.role, canWrite,
    fragment: (argId) => doc.getXmlFragment(`t:${argId}`),
    othersEditing: (argId) => { let on = false; awareness.getStates().forEach((st, cid) => { if (cid !== doc.clientID && (st as { editingId?: string }).editingId === argId) on = true; }); return on; },
    destroy() {
      if (destroyed) return;
      destroyed = true; clearTimeout(seedTimer); unsub(); unsubPresence(); awareness.off("change", onAw);
      provider.destroy(); um.destroy(); doc.destroy();
      store.setState({ readOnly: false, collabUndo: null });
      if (current === session) current = null;
      useCollab.getState().setPeers([]); useCollab.getState().setStatus("off");
    },
  };
  current?.destroy();
  current = session;
  return session;
}

export function openTransport(cfg: LiveConfig, make: { supabase?: () => Transport | null }): Transport | null {
  if (cfg.transport === "broadcast") return new BroadcastTransport(`openflow:round:${cfg.roundId}`);
  return make.supabase?.() ?? null;
}

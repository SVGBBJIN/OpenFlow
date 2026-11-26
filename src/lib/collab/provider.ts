import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import { fromB64, toB64, type Msg, type Transport } from "./core";

/**
 * Minimal Yjs sync provider over any broadcast Transport.
 * Viewers (canWrite=false) receive updates but never send document changes.
 */
export class CollabProvider {
  private origin = { provider: true };
  private closed = false;
  constructor(readonly doc: Y.Doc, readonly awareness: Awareness, private transport: Transport, private canWrite: boolean) {
    transport.onMessage((m) => this.receive(m));
    doc.on("update", this.onDocUpdate);
    awareness.on("update", this.onAwareness);
  }

  private get id() { return this.doc.clientID; }

  start() {
    this.transport.send({ t: "sync-req", from: this.id, sv: toB64(Y.encodeStateVector(this.doc)) });
    this.sendAwareness([this.id]);
  }

  private onDocUpdate = (u: Uint8Array, origin: unknown) => {
    if (origin === this.origin || this.closed || !this.canWrite) return;
    this.transport.send({ t: "update", from: this.id, u: toB64(u) });
  };
  private onAwareness = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === this.origin || this.closed) return;
    this.sendAwareness([...added, ...updated, ...removed]);
  };
  private sendAwareness(ids: number[]) {
    this.transport.send({ t: "aw", from: this.id, u: toB64(encodeAwarenessUpdate(this.awareness, ids)) });
  }

  private receive(m: Msg) {
    if (this.closed || m.from === this.id) return;
    if (m.t === "sync-req") {
      // Only peers allowed to write answer with document state; everyone shares presence.
      if (this.canWrite) this.transport.send({ t: "update", from: this.id, u: toB64(Y.encodeStateAsUpdate(this.doc, fromB64(m.sv))) });
      this.sendAwareness([this.id]);
    } else if (m.t === "update") Y.applyUpdate(this.doc, fromB64(m.u), this.origin);
    else applyAwarenessUpdate(this.awareness, fromB64(m.u), this.origin);
  }

  destroy() {
    if (this.closed) return;
    removeAwarenessStates(this.awareness, [this.id], "destroy");
    this.sendAwareness([this.id]);
    this.closed = true;
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwareness);
    this.transport.close();
  }
}

/* ───────────── transports ───────────── */

/** Same-browser tabs. Used for development/testing without a backend. */
export class BroadcastTransport implements Transport {
  private ch: BroadcastChannel;
  constructor(name: string) { this.ch = new BroadcastChannel(name); }
  send(m: Msg) { this.ch.postMessage(m); }
  onMessage(cb: (m: Msg) => void) { this.ch.onmessage = (e) => cb(e.data as Msg); }
  close() { this.ch.close(); }
}

/** In-memory bus for unit tests. */
export class MemoryBus {
  private peers = new Set<MemoryTransport>();
  join(): MemoryTransport { const t = new MemoryTransport(this); this.peers.add(t); return t; }
  deliver(from: MemoryTransport, m: Msg) { for (const p of this.peers) if (p !== from) p.cb?.(JSON.parse(JSON.stringify(m))); }
  drop(t: MemoryTransport) { this.peers.delete(t); }
}
export class MemoryTransport implements Transport {
  cb: ((m: Msg) => void) | null = null;
  constructor(private bus: MemoryBus) {}
  send(m: Msg) { this.bus.deliver(this, m); }
  onMessage(cb: (m: Msg) => void) { this.cb = cb; }
  close() { this.bus.drop(this); }
}

/** Supabase Realtime broadcast channel. Requires a configured project; not exercised by the automated tests. */
export interface RealtimeChannelLike {
  on(type: "broadcast", filter: { event: string }, cb: (p: { payload: Msg }) => void): RealtimeChannelLike;
  subscribe(cb?: (status: string) => void): RealtimeChannelLike;
  send(m: { type: "broadcast"; event: string; payload: Msg }): unknown;
  unsubscribe(): unknown;
}
export class SupabaseTransport implements Transport {
  private ready = false;
  private queue: Msg[] = [];
  private cb: ((m: Msg) => void) | null = null;
  constructor(private ch: RealtimeChannelLike) {
    ch.on("broadcast", { event: "m" }, ({ payload }) => this.cb?.(payload)).subscribe((status) => {
      if (status === "SUBSCRIBED") { this.ready = true; this.queue.splice(0).forEach((m) => this.send(m)); }
    });
  }
  send(m: Msg) { if (!this.ready) { this.queue.push(m); return; } void this.ch.send({ type: "broadcast", event: "m", payload: m }); }
  onMessage(cb: (m: Msg) => void) { this.cb = cb; }
  close() { void this.ch.unsubscribe(); }
}

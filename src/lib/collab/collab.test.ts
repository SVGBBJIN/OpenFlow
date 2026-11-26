import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { describe, expect, it } from "vitest";
import { applyArgsDiff, applyRoundDiff, readArgs, readRound, seedDoc, LOCAL } from "./core";
import { CollabProvider, MemoryBus } from "./provider";
import { blankArg, createResponse, createRoot, updateArg } from "../flow-ops";
import { PF_SPEECHES, type ArgMap, type Round } from "../types";

const round: Round = { id: "r", title: "T", tournament: "", side: "pro", opponent: "", partner: "", speeches: PF_SPEECHES.map((s, i) => ({ ...s, id: `s${i}` })), createdAt: 0, updatedAt: 0, deletedAt: null };

function peer(bus: MemoryBus, canWrite = true) {
  const doc = new Y.Doc(); const awareness = new Awareness(doc);
  const prov = new CollabProvider(doc, awareness, bus.join(), canWrite);
  return { doc, awareness, prov };
}

describe("collab core", () => {
  it("round trips args and keeps field-level merges for concurrent edits", () => {
    const a = createRoot({}, round, "pro", "s0"); const args: ArgMap = updateArg(a.args, a.id!, { text: "<p>x</p>" });
    const bus = new MemoryBus();
    const A = peer(bus), B = peer(bus);
    seedDoc(A.doc, round, args);
    A.prov.start(); B.prov.start();
    expect(readArgs(B.doc, "r")[a.id!].text).toBe("<p>x</p>");
    // Concurrent edits to different fields of the same argument both survive.
    const base = readArgs(A.doc, "r");
    applyArgsDiff(A.doc, base, { ...base, [a.id!]: { ...base[a.id!], status: "dropped" } });
    applyArgsDiff(B.doc, base, { ...base, [a.id!]: { ...base[a.id!], notes: "from B" } });
    const merged = readArgs(A.doc, "r")[a.id!];
    expect(merged).toMatchObject({ status: "dropped", notes: "from B" });
    expect(readArgs(B.doc, "r")[a.id!]).toMatchObject({ status: "dropped", notes: "from B" });
  });

  it("converges after concurrent structural edits (new responses, delete)", () => {
    const root = createRoot({}, round, "pro", "s0"); const args = root.args;
    const bus = new MemoryBus(); const A = peer(bus), B = peer(bus);
    seedDoc(A.doc, round, args); A.prov.start(); B.prov.start();
    const ra = createResponse(args, round, root.id!); applyArgsDiff(A.doc, args, ra.args);
    const rb = createResponse(args, round, root.id!); applyArgsDiff(B.doc, args, rb.args);
    const a = readArgs(A.doc, "r"), b = readArgs(B.doc, "r");
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(Object.keys(a)).toHaveLength(3);
    // delete on one side
    applyArgsDiff(A.doc, a, Object.fromEntries(Object.entries(a).filter(([k]) => k !== ra.id)));
    expect(Object.keys(readArgs(B.doc, "r"))).not.toContain(ra.id);
  });

  it("late joiner receives full state; viewer never writes", () => {
    const bus = new MemoryBus();
    const A = peer(bus); const root = createRoot({}, round, "pro", "s0");
    seedDoc(A.doc, round, root.args); A.prov.start();
    const V = peer(bus, false); V.prov.start();
    expect(Object.keys(readArgs(V.doc, "r"))).toEqual([root.id]);
    // viewer tries to change things: nothing reaches the owner
    const before = readArgs(V.doc, "r");
    applyArgsDiff(V.doc, before, { ...before, [root.id!]: { ...before[root.id!], notes: "sneaky" } });
    expect(readArgs(A.doc, "r")[root.id!].notes).toBe("");
  });

  it("round metadata and presence sync", () => {
    const bus = new MemoryBus(); const A = peer(bus), B = peer(bus);
    A.prov.start(); B.prov.start();
    applyRoundDiff(A.doc, null, round);
    applyRoundDiff(A.doc, round, { ...round, title: "Renamed" });
    expect(readRound(B.doc, round).title).toBe("Renamed");
    A.awareness.setLocalState({ user: { name: "Ann" }, selectedId: "x" });
    expect([...B.awareness.getStates().values()].some((s) => (s as { user?: { name: string } }).user?.name === "Ann")).toBe(true);
    A.prov.destroy();
    expect(B.awareness.getStates().has(A.doc.clientID)).toBe(false);
  });

  it("undo manager only undoes local changes", () => {
    const bus = new MemoryBus(); const A = peer(bus), B = peer(bus); A.prov.start(); B.prov.start();
    const root = createRoot({}, round, "pro", "s0"); seedDoc(A.doc, round, root.args);
    const um = new Y.UndoManager([A.doc.getMap("args")], { trackedOrigins: new Set([LOCAL]), captureTimeout: 0 });
    const cur = readArgs(A.doc, "r");
    applyArgsDiff(B.doc, cur, { ...cur, [root.id!]: { ...cur[root.id!], notes: "peer note" } });
    applyArgsDiff(A.doc, readArgs(A.doc, "r"), { ...readArgs(A.doc, "r"), [root.id!]: { ...readArgs(A.doc, "r")[root.id!], status: "dropped" } });
    um.undo();
    expect(readArgs(A.doc, "r")[root.id!]).toMatchObject({ status: "active", notes: "peer note" });
    void blankArg;
  });
});

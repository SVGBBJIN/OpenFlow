import { describe, expect, it } from "vitest";
import { createResponse, createRoot, createSibling, deleteSubtree, moveSibling, reparent, setSpeech, subtreeIds, toggleLink } from "./flow-ops";
import { layoutFlow, navigate } from "./layout";
import { PF_SPEECHES, type ArgMap, type Round } from "./types";

const round: Round = {
  id: "r", title: "t", tournament: "", side: "pro", opponent: "", partner: "",
  speeches: PF_SPEECHES.map((s, i) => ({ ...s, id: `s${i}` })),
  createdAt: 0, updatedAt: 0, deletedAt: null,
};
const colOf = (s: string) => round.speeches.findIndex((x) => x.id === s);

function build() {
  let args: ArgMap = {};
  const c1 = createRoot(args, round, "pro", "s0"); args = c1.args;
  const r1 = createResponse(args, round, c1.id!); args = r1.args;      // con constructive
  const rr = createResponse(args, round, r1.id!); args = rr.args;      // pro rebuttal
  const c2 = createSibling(args, round, c1.id!); args = c2.args;       // second contention
  const r2 = createResponse(args, round, c1.id!); args = r2.args;      // second response to c1
  return { args, c1: c1.id!, r1: r1.id!, rr: rr.id!, c2: c2.id!, r2: r2.id! };
}

describe("layout", () => {
  it("places first response on parent row, next response below, new contention after the subtree", () => {
    const { args, c1, r1, rr, c2, r2 } = build();
    const L = layoutFlow(args, "pro", colOf);
    expect(L.placed[c1]).toMatchObject({ col: 0, row: 0 });
    expect(L.placed[r1]).toMatchObject({ col: 1, row: 0 });
    expect(L.placed[rr]).toMatchObject({ col: 2, row: 0 });
    expect(L.placed[r2]).toMatchObject({ col: 1, row: 1 });
    expect(L.placed[c2]).toMatchObject({ col: 0, row: 2 });
    expect(L.order).toEqual([c1, r1, rr, r2, c2]);
  });
  it("never puts two cells in the same (col,row)", () => {
    const { args } = build();
    const L = layoutFlow(args, "pro", colOf);
    const seen = new Set(Object.values(L.placed).map((p) => `${p.col}:${p.row}`));
    expect(seen.size).toBe(Object.keys(L.placed).length);
  });
  it("same-column child starts a row lower", () => {
    const { args, c1 } = build();
    const sub = createRoot(args, round, "pro", "s0");
    const moved = reparent(sub.args, round, sub.id!, c1)!;
    const L = layoutFlow(moved, "pro", colOf);
    expect(L.placed[sub.id!].col).toBe(0);
    expect(L.placed[sub.id!].row).toBeGreaterThan(L.placed[c1].row);
  });
  it("collapse hides descendants and reports count", () => {
    const { args, c1 } = build();
    const L = layoutFlow({ ...args, [c1]: { ...args[c1], collapsed: true } }, "pro", colOf);
    expect(Object.keys(L.placed)).toHaveLength(2);
    expect(L.placed[c1].hidden).toBe(3);
  });
  it("keeps pro and con flows separate", () => {
    let { args } = build();
    const con = createRoot(args, round, "con", "s1"); args = con.args;
    expect(Object.keys(layoutFlow(args, "con", colOf).placed)).toEqual([con.id]);
    expect(Object.keys(layoutFlow(args, "pro", colOf).placed)).toHaveLength(5);
  });
});

describe("ops", () => {
  it("reparent keeps subtree intact and rejects cycles", () => {
    const { args, c1, r1, rr, c2 } = build();
    expect(reparent(args, round, c1, rr)).toBeNull();
    const moved = reparent(args, round, r1, c2)!;
    expect(moved[r1].parentId).toBe(c2);
    expect(moved[rr].parentId).toBe(r1);
    expect(subtreeIds(moved, c2)).toContain(rr);
  });
  it("setSpeech keeps children at or right of parent", () => {
    const { args, c1, r1, rr } = build();
    const m = setSpeech(args, round, c1, 3);
    expect(colOf(m[c1].speechId)).toBe(3);
    expect(colOf(m[r1].speechId)).toBeGreaterThanOrEqual(3);
    expect(colOf(m[rr].speechId)).toBeGreaterThanOrEqual(colOf(m[r1].speechId));
  });
  it("deleteSubtree removes descendants and dangling links", () => {
    const { args, c1, r1, c2 } = build();
    const linked = toggleLink(args, c2, r1);
    const { args: out, removed } = deleteSubtree(linked, c1);
    expect(removed).toHaveLength(4);
    expect(out[c2].linkedIds).toEqual([]);
  });
  it("moveSibling swaps order", () => {
    const { args, c1, c2 } = build();
    const m = moveSibling(args, c2, -1);
    const L = layoutFlow(m, "pro", colOf);
    expect(L.placed[c2].row).toBeLessThan(L.placed[c1].row);
  });
  it("extension keeps link to original", () => {
    const { args, c1 } = build();
    const e = createResponse(args, round, c1, { extend: true });
    expect(e.args[e.id!].extendsId).toBe(c1);
  });
});

describe("navigation", () => {
  it("moves right to first child, left to parent, up/down within column", () => {
    const { args, c1, r1, r2, c2 } = build();
    const L = layoutFlow(args, "pro", colOf);
    expect(navigate(L, args, c1, "right")).toBe(r1);
    expect(navigate(L, args, r1, "left")).toBe(c1);
    expect(navigate(L, args, r1, "down")).toBe(r2);
    expect(navigate(L, args, c1, "down")).toBe(c2);
    expect(navigate(L, args, c1, "up")).toBeNull();
  });
});

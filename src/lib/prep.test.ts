import { describe, expect, it } from "vitest";
import { addArgsToDoc, applySync, checkPlan, entriesForArg, entryState, moveItem, newDoc, planSync, reorderItem, trackerCounts, trackerRows, blankItem } from "./prep";
import { blankArg } from "./flow-ops";
import { blankCard } from "./library";
import { emptyPlan, PF_SPEECHES, type ArgMap, type Round } from "./types";

const round: Round = { id: "r", title: "T", tournament: "", side: "pro", opponent: "", partner: "", speeches: PF_SPEECHES.map((s, i) => ({ ...s, id: `s${i}` })), createdAt: 0, updatedAt: 0, deletedAt: null };
const mk = (over: object) => blankArg(round, { flow: "pro", speechId: "s0", ...over });

describe("final focus checks", () => {
  const a = mk({ id: "a", text: "<p>Alpha</p>", status: "dropped" });
  const b = mk({ id: "b", text: "<p>Beta</p>", evidenceIds: ["c1"] });
  const args: ArgMap = { a, b };
  it("flags only organisational inconsistencies", () => {
    const plans = { summary: { ...emptyPlan(), items: [blankItem("b")] }, finalFocus: { ...emptyPlan(), items: [blankItem("a"), blankItem("b")] } };
    plans.summary.items[0].weighing = [{ id: "w", mechanism: "magnitude", text: "x" }];
    const codes = checkPlan("finalFocus", plans, args).map((i) => `${i.argId}:${i.code}`).sort();
    expect(codes).toEqual(["a:dropped-included", "a:ff-not-in-summary", "a:no-evidence", "a:no-weighing", "b:no-weighing"]);
  });
  it("clean item raises nothing", () => {
    const it = blankItem("b"); it.weighing = [{ id: "w", mechanism: "scope", text: "x" }];
    expect(checkPlan("summary", { summary: { ...emptyPlan(), items: [it] }, finalFocus: emptyPlan() }, args)).toEqual([]);
  });
  it("reorders", () => {
    const p = { ...emptyPlan(), items: [blankItem("a"), blankItem("b")] };
    expect(moveItem(p, p.items[1].id, -1).items[0].argId).toBe("b");
    expect(reorderItem(p, p.items[0].id, p.items[1].id).items[1].argId).toBe("a");
  });
});

describe("tracker", () => {
  it("counts from user-entered data only", () => {
    const root = mk({ id: "r1", text: "<p>C1</p>" });
    const resp = mk({ id: "r2", parentId: "r1", status: "dropped" });
    const ext = mk({ id: "r3", parentId: "r1", extendsId: "r1" });
    const turn = mk({ id: "r4", parentId: "r1", isTurn: true });
    const args: ArgMap = { r1: root, r2: resp, r3: ext, r4: turn };
    const plans = { summary: { ...emptyPlan(), items: [blankItem("r1")] }, finalFocus: emptyPlan() };
    const rows = trackerRows(args, plans);
    expect(trackerCounts(args, rows)).toMatchObject({ introduced: 1, responses: 1, extensions: 1, dropped: 1, turned: 1, inSummary: 1, inFinalFocus: 0 });
    expect(rows.find((r) => r.id === "r1")).toMatchObject({ extended: true, turned: true, responses: 1 });
  });
});

describe("explicit document sync", () => {
  it("state machine", () => {
    expect(entryState("a", "a", "a")).toBe("unchanged");
    expect(entryState("a", "a", "b")).toBe("incoming");
    expect(entryState("m", "a", "a")).toBe("local");
    expect(entryState("m", "a", "b")).toBe("conflict");
    expect(entryState("a", "a", null)).toBe("missing");
  });
  it("never overwrites local edits without a decision, and resolves manually", () => {
    const card = blankCard({ id: "c", tag: "T", bodyHtml: "<p>v1</p>" });
    const arg = mk({ id: "a", text: "<p>claim v1</p>", inserts: [{ id: "i", blockId: null, name: "x", at: 0, entries: [{ id: "e", cardId: "c", tag: "T", citation: "K 20", html: "<p>v1</p>", kind: "card" }] }] });
    let args: ArgMap = { a: arg };
    const cards = { c: card };
    let doc = addArgsToDoc(newDoc({ title: "d", template: "blank" }), ["a"], args, cards).doc;
    expect(doc.entries.map((e) => e.kind)).toEqual(["arg", "card"]);
    expect(addArgsToDoc(doc, ["a"], args, cards)).toMatchObject({ added: 0, skipped: 1 });
    // user edits the doc claim; flow also changes -> conflict
    doc = { ...doc, entries: doc.entries.map((e) => (e.kind === "arg" ? { ...e, content: "<p>my edit</p>" } : e)) };
    args = { a: { ...arg, text: "<p>claim v2</p>" } };
    const card2 = { ...card, bodyHtml: "<p>v2</p>" };
    const plan = planSync(doc, args, { c: card2 });
    expect(plan.map((p) => p.state)).toEqual(["conflict", "incoming"]);
    const kept = applySync(doc, { [plan[0].entryId]: "mine", [plan[1].entryId]: "source" }, args, { c: card2 });
    const argE = kept.entries[0] as { content: string; base: string };
    expect(argE.content).toBe("<p>my edit</p>");
    expect(argE.base).toBe("<p>claim v2</p>");
    expect((kept.entries[1] as { content: string }).content).toBe("<p>v2</p>");
    expect(planSync(kept, args, { c: card2 }).map((p) => p.state)).toEqual(["local", "unchanged"]);
    expect(entriesForArg(arg, cards)).toHaveLength(2);
  });
});

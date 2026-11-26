import { describe, expect, it } from "vitest";
import { entryParents, parseSpeechText } from "./speech-import";
import { fromBundle, roundToNodes, toBundle } from "./round-export";
import { createResponse, createRoot, toggleLink } from "./flow-ops";
import { diffSummary } from "./versions";
import { PF_SPEECHES, type Round } from "./types";

const round: Round = { id: "r", title: "T", tournament: "", side: "pro", opponent: "", partner: "", speeches: PF_SPEECHES.map((s, i) => ({ ...s, id: `s${i}` })), createdAt: 0, updatedAt: 0, deletedAt: null };

describe("speech import parser", () => {
  it("nests bullets under headings deterministically", () => {
    const e = parseSpeechText("Contention 1: Economy\n- Growth is up\n    - because of trade\nContention 2: Environment\n- Emissions fall");
    expect(e.map((x) => x.depth)).toEqual([0, 1, 2, 0, 1]);
    expect(entryParents(e)).toEqual([null, 0, 1, null, 3]);
    expect(e[1].text).toBe("Growth is up");
  });
  it("blank lines ignored, first entry always root", () => {
    const e = parseSpeechText("\n   - indented first\n\nplain");
    expect(e.map((x) => x.depth)).toEqual([0, 0]);
  });
});

describe("round export/import", () => {
  it("round-trips as a fresh, collision-free copy preserving relationships", () => {
    const c = createRoot({}, round, "pro", "s0"); let args = c.args;
    const r = createResponse(args, round, c.id!); args = r.args;
    args = toggleLink(args, c.id!, r.id!);
    const out = fromBundle(JSON.parse(JSON.stringify(toBundle({ ...round, plans: { summary: { items: [{ id: "i", argId: c.id!, offense: true, needsDefense: false, voting: false, responseIds: [r.id!], extraCardIds: [], weighing: [], opposingIds: [], comparison: "", note: "" }], weighingNotes: "", narrative: "", impactCalculus: "" }, finalFocus: { items: [], weighingNotes: "", narrative: "", impactCalculus: "" } } }, args))));
    const ids = Object.keys(out.args);
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain(c.id);
    const child = Object.values(out.args).find((a) => a.parentId)!;
    expect(out.args[child.parentId!]).toBeTruthy();
    expect(child.linkedIds).toHaveLength(1);
    expect(out.round.speeches.map((s) => s.id)).not.toContain("s0");
    expect(out.args[ids[0]].speechId).toBe(out.round.speeches[0].id);
    expect(out.round.plans!.summary.items[0].responseIds[0]).toBe(child.id);
    expect(() => fromBundle({})).toThrow();
  });
  it("docx nodes include a table per flow", () => {
    const c = createRoot({}, round, "pro", "s0");
    const nodes = roundToNodes(round, c.args);
    expect(nodes.filter((n) => n.type === "table")).toHaveLength(1);
  });
  it("diff summary", () => {
    const c = createRoot({}, round, "pro", "s0");
    expect(diffSummary({}, c.args)).toEqual({ added: 1, removed: 0, changed: 0 });
  });
});

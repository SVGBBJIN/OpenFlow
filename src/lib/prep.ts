import { newId } from "./flow-ops";
import type { EvidenceCard } from "./library";
import { htmlToText } from "./sanitize";
import { childIndex } from "./layout";
import type { Arg, ArgMap, PlanItem, Plans, Round, SpeechPlan, Status, WeighMechanism } from "./types";
import { emptyPlan } from "./types";

/* ───────────── Plans (Summary / Final Focus builders) ───────────── */

export type PlanKind = "summary" | "finalFocus";
export const ensurePlans = (r: Round): Plans => r.plans ?? { summary: emptyPlan(), finalFocus: emptyPlan() };

export function blankItem(argId: string): PlanItem {
  return { id: newId(), argId, offense: false, needsDefense: false, voting: false, responseIds: [], extraCardIds: [], weighing: [], opposingIds: [], comparison: "", note: "" };
}

export function descendantIds(args: ArgMap, id: string): string[] {
  const idx = childIndex(args);
  const out: string[] = [];
  const walk = (x: string) => { for (const k of idx.get(x) ?? []) { out.push(k.id); walk(k.id); } };
  walk(id);
  return out;
}

export function moveItem(plan: SpeechPlan, itemId: string, dir: -1 | 1): SpeechPlan {
  const i = plan.items.findIndex((x) => x.id === itemId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= plan.items.length) return plan;
  const items = [...plan.items];
  [items[i], items[j]] = [items[j], items[i]];
  return { ...plan, items };
}
export function reorderItem(plan: SpeechPlan, fromId: string, toId: string): SpeechPlan {
  const from = plan.items.findIndex((x) => x.id === fromId), to = plan.items.findIndex((x) => x.id === toId);
  if (from < 0 || to < 0 || from === to) return plan;
  const items = [...plan.items];
  const [it] = items.splice(from, 1);
  items.splice(to, 0, it);
  return { ...plan, items };
}

export interface Issue { code: "ff-not-in-summary" | "no-evidence" | "no-weighing" | "dropped-included"; itemId: string; argId: string; message: string }

export const hasEvidence = (a: Arg, it: PlanItem) => it.extraCardIds.length > 0 || a.inserts.some((i) => i.entries.some((e) => e.kind === "card")) || a.evidenceIds.length > 0;

/**
 * Deterministic organisational checks. They only report inconsistencies in what the user entered —
 * they never rank, recommend or decide anything strategic.
 */
export function checkPlan(kind: PlanKind, plans: Plans, args: ArgMap): Issue[] {
  const plan = plans[kind];
  const label = (a: Arg) => `“${htmlToText(a.text).slice(0, 48) || "(empty)"}”`;
  const out: Issue[] = [];
  const inSummary = new Set(plans.summary.items.map((i) => i.argId));
  for (const it of plan.items) {
    const a = args[it.argId];
    if (!a) continue;
    if (kind === "finalFocus" && !inSummary.has(it.argId)) out.push({ code: "ff-not-in-summary", itemId: it.id, argId: a.id, message: `${label(a)} is in Final Focus but not in your Summary outline.` });
    if (!hasEvidence(a, it)) out.push({ code: "no-evidence", itemId: it.id, argId: a.id, message: `${label(a)} has no linked evidence.` });
    if (it.weighing.length === 0) out.push({ code: "no-weighing", itemId: it.id, argId: a.id, message: `${label(a)} has no recorded weighing.` });
    if (a.status === "dropped") out.push({ code: "dropped-included", itemId: it.id, argId: a.id, message: `${label(a)} is marked dropped but is included in this speech — confirm that is intended.` });
  }
  return out;
}

/* ───────────── Round-wide tracker ───────────── */

export interface TrackerRow {
  id: string; flow: Arg["flow"]; text: string; speechId: string; status: Status; priority: number; rootId: string; rootText: string;
  responses: number; extended: boolean; turned: boolean; inSummary: boolean; inFinalFocus: boolean;
}
export interface TrackerCounts { introduced: number; responses: number; extensions: number; dropped: number; answered: number; turned: number; unresolved: number; inSummary: number; inFinalFocus: number }

export function trackerRows(args: ArgMap, plans: Plans): TrackerRow[] {
  const idx = childIndex(args);
  const rootOf = (a: Arg) => { let c = a; while (c.parentId && args[c.parentId]) c = args[c.parentId]; return c; };
  const sum = new Set(plans.summary.items.map((i) => i.argId)), ff = new Set(plans.finalFocus.items.map((i) => i.argId));
  return Object.values(args).map((a) => {
    const root = rootOf(a);
    const kids = idx.get(a.id) ?? [];
    return {
      id: a.id, flow: a.flow, text: htmlToText(a.text), speechId: a.speechId, status: a.status, priority: a.priority,
      rootId: root.id, rootText: htmlToText(root.text),
      responses: kids.filter((k) => !k.extendsId && !k.isTurn).length,
      extended: a.status === "extended" || kids.some((k) => !!k.extendsId) || !!a.extendsId,
      turned: a.status === "turned" || a.isTurn || kids.some((k) => k.isTurn),
      inSummary: sum.has(a.id), inFinalFocus: ff.has(a.id),
    };
  });
}
export function trackerCounts(args: ArgMap, rows: TrackerRow[]): TrackerCounts {
  const all = Object.values(args);
  return {
    introduced: all.filter((a) => !a.parentId).length,
    responses: all.filter((a) => a.parentId && !a.extendsId && !a.isTurn).length,
    extensions: all.filter((a) => a.extendsId || a.status === "extended").length,
    dropped: all.filter((a) => a.status === "dropped").length,
    answered: all.filter((a) => a.status === "answered").length,
    turned: all.filter((a) => a.isTurn || a.status === "turned").length,
    unresolved: all.filter((a) => a.status === "unresolved").length,
    inSummary: rows.filter((r) => r.inSummary).length,
    inFinalFocus: rows.filter((r) => r.inFinalFocus).length,
  };
}

/* ───────────── Speech documents + explicit sync ───────────── */

export type DocEntry =
  | { id: string; kind: "heading"; level: 1 | 2 | 3; text: string }
  | { id: string; kind: "text"; html: string }
  | { id: string; kind: "arg"; argId: string; content: string; base: string }
  | { id: string; kind: "card"; cardId: string | null; tag: string; citation: string; content: string; base: string; fromArgId?: string };

export interface SpeechDoc {
  id: string; title: string; template: TemplateId; roundId: string | null; speechName: string;
  entries: DocEntry[]; createdAt: number; updatedAt: number;
}

export type TemplateId = "blank" | "constructive" | "rebuttal" | "summary" | "finalFocus";
export const TEMPLATES: Record<TemplateId, { label: string; headings: string[] }> = {
  blank: { label: "Blank", headings: [] },
  constructive: { label: "Constructive", headings: ["Framework / Overview", "Contention 1", "Contention 2"] },
  rebuttal: { label: "Rebuttal", headings: ["Overview", "Responses to Contention 1", "Responses to Contention 2", "Frontlines"] },
  summary: { label: "Summary", headings: ["Overview", "Collapse", "Offense", "Defense", "Weighing"] },
  finalFocus: { label: "Final Focus", headings: ["Voting Issues", "Impact Calculus", "Ballot Story"] },
};

export function newDoc(o: { title: string; template: TemplateId; roundId?: string | null; speechName?: string }): SpeechDoc {
  const now = Date.now();
  return {
    id: newId(), title: o.title || "Untitled speech", template: o.template, roundId: o.roundId ?? null, speechName: o.speechName ?? "",
    entries: TEMPLATES[o.template].headings.map((text) => ({ id: newId(), kind: "heading" as const, level: 2 as const, text })),
    createdAt: now, updatedAt: now,
  };
}

/** Flow argument → document entries (claim + its attached library cards/text, each linked back to its source). */
export function entriesForArg(a: Arg, cards: Record<string, EvidenceCard>): DocEntry[] {
  const out: DocEntry[] = [{ id: newId(), kind: "arg", argId: a.id, content: a.text, base: a.text }];
  for (const ins of a.inserts) for (const e of ins.entries) {
    if (e.kind === "text") out.push({ id: newId(), kind: "text", html: e.html });
    else out.push({ id: newId(), kind: "card", cardId: e.cardId, tag: e.tag, citation: e.citation, content: e.html, base: e.cardId && cards[e.cardId] ? cards[e.cardId].bodyHtml : e.html, fromArgId: a.id });
  }
  return out;
}

export function addArgsToDoc(doc: SpeechDoc, argIds: string[], args: ArgMap, cards: Record<string, EvidenceCard>): { doc: SpeechDoc; added: number; skipped: number } {
  const present = new Set(doc.entries.flatMap((e) => (e.kind === "arg" ? [e.argId] : [])));
  let added = 0, skipped = 0;
  const entries = [...doc.entries];
  for (const id of argIds) {
    const a = args[id];
    if (!a) continue;
    if (present.has(id)) { skipped++; continue; }
    entries.push(...entriesForArg(a, cards));
    present.add(id); added++;
  }
  return { doc: { ...doc, entries, updatedAt: Date.now() }, added, skipped };
}

export type SyncState = "unchanged" | "incoming" | "local" | "conflict" | "missing";
export interface SyncItem { entryId: string; label: string; state: SyncState; source: string | null; content: string }

export function sourceFor(e: DocEntry, args: ArgMap, cards: Record<string, EvidenceCard>): string | null {
  if (e.kind === "arg") return args[e.argId]?.text ?? null;
  if (e.kind === "card") return e.cardId ? (cards[e.cardId]?.bodyHtml ?? null) : e.content;
  return null;
}
export function entryState(content: string, base: string, source: string | null): SyncState {
  if (source === null) return "missing";
  if (content === source) return "unchanged";
  const srcChanged = source !== base, localChanged = content !== base;
  if (srcChanged && localChanged) return "conflict";
  if (srcChanged) return "incoming";
  if (localChanged) return "local";
  return "unchanged";
}
export function planSync(doc: SpeechDoc, args: ArgMap, cards: Record<string, EvidenceCard>): SyncItem[] {
  const out: SyncItem[] = [];
  for (const e of doc.entries) {
    if (e.kind !== "arg" && e.kind !== "card") continue;
    const source = sourceFor(e, args, cards);
    out.push({ entryId: e.id, label: e.kind === "arg" ? htmlToText(e.content).slice(0, 60) : e.tag, state: entryState(e.content, e.base, source), source, content: e.content });
  }
  return out;
}
/** Apply explicit per-entry decisions. "source" takes the flow/library text; "mine" keeps the document text and acknowledges the source. */
export function applySync(doc: SpeechDoc, decisions: Record<string, "source" | "mine">, args: ArgMap, cards: Record<string, EvidenceCard>): SpeechDoc {
  const entries = doc.entries.map((e) => {
    const d = decisions[e.id];
    if (!d || (e.kind !== "arg" && e.kind !== "card")) return e;
    const source = sourceFor(e, args, cards);
    if (source === null) return e;
    if (e.kind === "card") {
      const c = e.cardId ? cards[e.cardId] : null;
      return d === "source" ? { ...e, content: source, base: source, tag: c?.tag ?? e.tag, citation: c?.citation || e.citation } : { ...e, base: source };
    }
    return d === "source" ? { ...e, content: source, base: source } : { ...e, base: source };
  });
  return { ...doc, entries, updatedAt: Date.now() };
}

/** Build a speech document from a Summary / Final Focus plan using live flow data. */
export function docFromPlan(kind: PlanKind, round: Round, plan: SpeechPlan, args: ArgMap, cards: Record<string, EvidenceCard>): SpeechDoc {
  const doc = newDoc({ title: `${round.title} — ${kind === "summary" ? "Summary" : "Final Focus"}`, template: "blank", roundId: round.id, speechName: kind === "summary" ? "Summary" : "Final Focus" });
  const E: DocEntry[] = [];
  if (plan.narrative.trim()) E.push({ id: newId(), kind: "heading", level: 2, text: "Narrative" }, { id: newId(), kind: "text", html: `<p>${esc(plan.narrative)}</p>` });
  plan.items.forEach((it, n) => {
    const a = args[it.argId]; if (!a) return;
    E.push({ id: newId(), kind: "heading", level: 2, text: `${n + 1}. ${htmlToText(a.text).slice(0, 80)}${it.voting ? " (voting issue)" : ""}` });
    E.push(...entriesForArg(a, cards));
    for (const rid of it.responseIds) if (args[rid]) E.push({ id: newId(), kind: "arg", argId: rid, content: args[rid].text, base: args[rid].text });
    for (const cid of it.extraCardIds) { const c = cards[cid]; if (c) E.push({ id: newId(), kind: "card", cardId: c.id, tag: c.tag, citation: c.citation, content: c.bodyHtml, base: c.bodyHtml }); }
    if (it.weighing.length) E.push({ id: newId(), kind: "text", html: it.weighing.map((w) => `<p><b>${w.mechanism}:</b> ${esc(w.text)}</p>`).join("") });
  });
  if (plan.weighingNotes.trim() || plan.impactCalculus.trim()) E.push({ id: newId(), kind: "heading", level: 2, text: kind === "summary" ? "Weighing" : "Impact calculus" }, { id: newId(), kind: "text", html: `<p>${esc(plan.weighingNotes || plan.impactCalculus)}</p>` });
  return { ...doc, entries: E };
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

export const WEIGH_HELP: Record<WeighMechanism, string> = {
  magnitude: "How big is the impact?", probability: "How likely is it?", timeframe: "How soon does it happen?",
  scope: "How many people are affected?", reversibility: "Can it be undone?", structural: "Does it come first / frame the round?",
};

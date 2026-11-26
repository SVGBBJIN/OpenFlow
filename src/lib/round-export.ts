import { layoutFlow } from "./layout";
import type { ExportNode } from "./export-docx";
import { htmlToText } from "./sanitize";
import type { ArgMap, Round, Side } from "./types";
import { newId } from "./flow-ops";

export interface RoundBundle { app: "openflow"; version: 1; round: Round; args: ArgMap; exportedAt: number }

export const toBundle = (round: Round, args: ArgMap): RoundBundle => ({ app: "openflow", version: 1, round, args, exportedAt: Date.now() });

/** Import as a fresh copy: every id is remapped so it can never collide with or overwrite existing data. */
export function fromBundle(raw: unknown): { round: Round; args: ArgMap } {
  const b = raw as Partial<RoundBundle>;
  if (!b || b.app !== "openflow" || !b.round || !b.args) throw new Error("Not an OpenFlow round export");
  const map = new Map<string, string>();
  const re = (id: string | null) => (id == null ? null : (map.get(id) ?? (map.set(id, newId()), map.get(id)!)));
  const rid = newId();
  const speeches = b.round.speeches.map((s) => ({ ...s, id: re(s.id)! }));
  const args: ArgMap = {};
  for (const a of Object.values(b.args)) {
    const id = re(a.id)!;
    args[id] = { ...a, id, roundId: rid, speechId: re(a.speechId)!, parentId: re(a.parentId), extendsId: re(a.extendsId), linkedIds: a.linkedIds.map((x) => re(x)!), inserts: a.inserts ?? [], evidenceIds: a.evidenceIds ?? [] };
  }
  const remapPlan = (p: NonNullable<Round["plans"]>["summary"]) => ({ ...p, items: p.items.map((i) => ({ ...i, id: newId(), argId: re(i.argId)!, responseIds: i.responseIds.map((x) => re(x)!), opposingIds: i.opposingIds.map((x) => re(x)!) })) });
  const plans = b.round.plans ? { summary: remapPlan(b.round.plans.summary), finalFocus: remapPlan(b.round.plans.finalFocus) } : undefined;
  const review = b.round.review ? { ...b.round.review, argNotes: Object.fromEntries(Object.entries(b.round.review.argNotes ?? {}).map(([k, v]) => [re(k)!, v])) } : undefined;
  return { round: { ...b.round, id: rid, title: `${b.round.title} (imported)`, speeches, plans, review, deletedAt: null, updatedAt: Date.now() }, args };
}

/** Flow grid (one table per side) + review notes, as export nodes shared with the DOCX writer. */
export function roundToNodes(round: Round, args: ArgMap): ExportNode[] {
  const out: ExportNode[] = [{ type: "title", text: round.title }];
  const meta = [round.tournament, round.opponent && `vs ${round.opponent}`, round.partner && `with ${round.partner}`, `Flowing ${round.side.toUpperCase()}`].filter(Boolean).join(" · ");
  out.push({ type: "html", html: `<p>${meta}</p>` });
  const colOf = (sid: string) => round.speeches.findIndex((s) => s.id === sid);
  for (const flow of ["pro", "con"] as Side[]) {
    const L = layoutFlow(args, flow, colOf);
    out.push({ type: "heading", level: 1, text: `${flow === "pro" ? "Pro" : "Con"} flow` });
    if (!L.order.length) { out.push({ type: "html", html: "<p>(empty)</p>" }); continue; }
    const rows: string[][] = [round.speeches.map((s) => s.name)];
    for (let r = 0; r < L.rows; r++) rows.push(round.speeches.map(() => ""));
    for (const id of L.order) {
      const p = L.placed[id], a = args[id];
      const tags = [a.status !== "active" ? a.status : "", a.isTurn ? "turn" : "", a.extendsId ? "ext" : "", a.priority ? "!".repeat(a.priority) : ""].filter(Boolean);
      rows[p.row + 1][p.col] = (tags.length ? `[${tags.join(", ")}] ` : "") + htmlToText(a.text) + (a.inserts.length ? `\n▤ ${a.inserts.flatMap((i) => i.entries.map((e) => e.tag || "text")).join("; ")}` : "");
    }
    out.push({ type: "table", rows });
  }
  const rv = round.review;
  if (rv) {
    out.push({ type: "heading", level: 1, text: "Review" });
    const sec = (h: string, t: string) => t.trim() && out.push({ type: "heading", level: 2, text: h }, { type: "html", html: `<p>${t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>` });
    if (rv.result) sec("Result (entered by you)", rv.result);
    sec("Judge", rv.judge); sec("Ballot", rv.ballot); sec("Reason for decision", rv.rfd);
    sec("Judge feedback", rv.judgeFeedback); sec("Opponent strategy", rv.opponentStrategy); sec("Personal observations", rv.observations);
  }
  return out;
}

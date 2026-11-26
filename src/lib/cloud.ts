"use client";
import { getSupabase } from "./supabase/client";
import { SupabaseTransport, type RealtimeChannelLike } from "./collab/provider";
import type { Role } from "./collab/session";
import { childIndex } from "./layout";
import type { Arg, ArgMap, Round } from "./types";
import { normalizeArg } from "./store";

/* NOTE: everything in this file talks to a live Supabase project and is NOT exercised by the automated tests
   (the schema/RLS it relies on is — see supabase/tests/rls.mjs). Verify against your project before relying on it. */

const sb = () => { const c = getSupabase(); if (!c) throw new Error("Supabase is not configured"); return c; };

export async function currentUser() {
  const c = getSupabase(); if (!c) return null;
  const { data } = await c.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
}

const iso = (n: number) => new Date(n).toISOString();
const ms = (s: string | null) => (s ? Date.parse(s) : 0);

function depthOrder(args: ArgMap): Arg[] {
  const idx = childIndex(args);
  const out: Arg[] = [];
  const walk = (list: Arg[]) => { for (const a of list) { out.push(a); walk(idx.get(a.id) ?? []); } };
  walk(idx.get("") ?? []);
  return out;
}

/** Upsert a round and its speeches/arguments/links as normalised rows. Needs editor/owner rights (enforced by RLS). */
export async function pushRound(round: Round, args: ArgMap): Promise<void> {
  const c = sb();
  const u = await currentUser(); if (!u) throw new Error("Sign in first");
  const { data: existing } = await c.from("rounds").select("id, owner_id").eq("id", round.id).maybeSingle();
  const base = {
    id: round.id, title: round.title, tournament: round.tournament, side: round.side, opponent: round.opponent,
    partner_name: round.partner, deleted_at: round.deletedAt ? iso(round.deletedAt) : null, updated_at: iso(round.updatedAt),
    plans: round.plans ?? null, review: round.review ?? null, completed: !!round.completed,
  };
  const r1 = existing ? await c.from("rounds").update(base).eq("id", round.id) : await c.from("rounds").insert({ ...base, owner_id: u.id, created_at: iso(round.createdAt) });
  if (r1.error) throw r1.error;
  const sp = await c.from("speeches").upsert(round.speeches.map((s, i) => ({ id: s.id, round_id: round.id, position: i, name: s.name, side: s.side, minutes: s.minutes })));
  if (sp.error) throw sp.error;
  const list = depthOrder(args);
  for (let i = 0; i < list.length; i += 200) {
    // parents are always earlier in the list, satisfying the parent_id foreign key
    const rows = list.slice(i, i + 200).map((a) => ({
      id: a.id, round_id: round.id, flow: a.flow, speech_id: a.speechId, parent_id: a.parentId, extends_id: a.extendsId, sort_order: a.order,
      body_html: a.text, status: a.status, priority: a.priority, tags: a.tags, notes: a.notes, impact: a.impact, collapsed: a.collapsed, is_turn: a.isTurn,
      inserts: a.inserts, evidence_ids: a.evidenceIds, created_at: iso(a.createdAt), updated_at: iso(a.updatedAt),
    }));
    const ar = await c.from("arguments").upsert(rows);
    if (ar.error) throw ar.error;
  }
  const { data: have } = await c.from("arguments").select("id").eq("round_id", round.id);
  const gone = (have ?? []).map((x: { id: string }) => x.id).filter((id: string) => !args[id]);
  if (gone.length) await c.from("arguments").delete().in("id", gone);
  const ids = Object.keys(args);
  if (ids.length) {
    await c.from("argument_links").delete().in("a_id", ids);
    const links = new Set<string>();
    for (const a of Object.values(args)) for (const l of a.linkedIds) if (args[l]) links.add(a.id < l ? `${a.id}|${l}` : `${l}|${a.id}`);
    if (links.size) await c.from("argument_links").insert([...links].map((k) => { const [a, b] = k.split("|"); return { a_id: a, b_id: b }; }));
  }
}

export async function pullRound(id: string): Promise<{ round: Round; args: ArgMap; role: Role }> {
  const c = sb();
  const u = await currentUser(); if (!u) throw new Error("Sign in first");
  const [r, s, a, l, m] = await Promise.all([
    c.from("rounds").select("*").eq("id", id).single(),
    c.from("speeches").select("*").eq("round_id", id).order("position"),
    c.from("arguments").select("*").eq("round_id", id),
    c.from("argument_links").select("a_id,b_id"),
    c.from("round_members").select("role").eq("round_id", id).eq("user_id", u.id).maybeSingle(),
  ]);
  if (r.error) throw r.error;
  const row = r.data;
  const round: Round = {
    id: row.id, title: row.title, tournament: row.tournament, side: row.side, opponent: row.opponent, partner: row.partner_name,
    speeches: (s.data ?? []).map((x: { id: string; name: string; side: "pro" | "con"; minutes: number }) => ({ id: x.id, name: x.name, side: x.side, minutes: x.minutes })),
    createdAt: ms(row.created_at), updatedAt: ms(row.updated_at), deletedAt: row.deleted_at ? ms(row.deleted_at) : null,
    plans: row.plans ?? undefined, review: row.review ?? undefined, completed: row.completed,
  };
  const args: ArgMap = {};
  for (const x of (a.data ?? []) as Record<string, unknown>[]) {
    args[x.id as string] = normalizeArg({
      id: x.id as string, roundId: id, flow: x.flow as Arg["flow"], speechId: x.speech_id as string, parentId: (x.parent_id as string) ?? null, order: x.sort_order as number,
      text: x.body_html as string, status: x.status as Arg["status"], priority: x.priority as Arg["priority"], tags: x.tags as string[], notes: x.notes as string, impact: x.impact as string,
      collapsed: x.collapsed as boolean, isTurn: x.is_turn as boolean, extendsId: (x.extends_id as string) ?? null, linkedIds: [], evidenceIds: (x.evidence_ids as string[]) ?? [],
      inserts: (x.inserts as Arg["inserts"]) ?? [], createdAt: ms(x.created_at as string), updatedAt: ms(x.updated_at as string),
    });
  }
  for (const k of (l.data ?? []) as { a_id: string; b_id: string }[]) {
    if (args[k.a_id] && args[k.b_id]) { args[k.a_id].linkedIds.push(k.b_id); args[k.b_id].linkedIds.push(k.a_id); }
  }
  const role: Role = row.owner_id === u.id ? "owner" : ((m.data?.role as Role) ?? "viewer");
  return { round, args, role };
}

export async function listShared(): Promise<{ round: Round; role: Role }[]> {
  const c = sb();
  const u = await currentUser(); if (!u) return [];
  const { data, error } = await c.from("round_members").select("role, rounds(id,title,tournament,side,opponent,partner_name,created_at,updated_at,deleted_at,owner_id)").eq("user_id", u.id);
  if (error) throw error;
  return ((data ?? []) as unknown as { role: Role; rounds: Record<string, string> | null }[]).filter((x) => x.rounds && x.role !== "owner").map((x) => ({
    role: x.role,
    round: { id: x.rounds!.id, title: x.rounds!.title, tournament: x.rounds!.tournament, side: x.rounds!.side as "pro" | "con", opponent: x.rounds!.opponent, partner: x.rounds!.partner_name, speeches: [], createdAt: ms(x.rounds!.created_at), updatedAt: ms(x.rounds!.updated_at), deletedAt: null },
  }));
}

export async function createInvite(roundId: string, role: "editor" | "viewer"): Promise<string> {
  const { data, error } = await sb().from("round_invites").insert({ round_id: roundId, role }).select("token").single();
  if (error) throw error;
  return data.token as string;
}
export async function listInvites(roundId: string) {
  const { data, error } = await sb().from("round_invites").select("token, role, expires_at, revoked").eq("round_id", roundId).eq("revoked", false);
  if (error) throw error;
  return (data ?? []) as { token: string; role: "editor" | "viewer"; expires_at: string; revoked: boolean }[];
}
export async function revokeInvite(token: string) { const { error } = await sb().from("round_invites").update({ revoked: true }).eq("token", token); if (error) throw error; }
export async function acceptInvite(token: string): Promise<string> { const { data, error } = await sb().rpc("accept_invite", { p_token: token }); if (error) throw error; return data as string; }
export async function listMembers(roundId: string) {
  const { data, error } = await sb().from("round_members").select("user_id, role, profiles(display_name)").eq("round_id", roundId);
  if (error) throw error;
  return (data ?? []) as unknown as { user_id: string; role: Role; profiles: { display_name: string } | null }[];
}
export async function setMemberRole(roundId: string, userId: string, role: Role) { const { error } = await sb().from("round_members").update({ role }).eq("round_id", roundId).eq("user_id", userId); if (error) throw error; }
export async function removeMember(roundId: string, userId: string) { const { error } = await sb().from("round_members").delete().eq("round_id", roundId).eq("user_id", userId); if (error) throw error; }

export function cloudTransport(roundId: string): SupabaseTransport {
  const channel = sb().channel(`round:${roundId}`, { config: { broadcast: { self: false }, private: process.env.NEXT_PUBLIC_REALTIME_PRIVATE !== "false" } });
  return new SupabaseTransport(channel as unknown as RealtimeChannelLike);
}

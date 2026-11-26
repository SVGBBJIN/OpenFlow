"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createInvite, listInvites, listMembers, pushRound, removeMember, revokeInvite, setMemberRole } from "@/lib/cloud";
import { useCollab, type Role } from "@/lib/collab/session";
import { supabaseConfigured } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import type { Round } from "@/lib/types";
import Link from "next/link";

type Member = Awaited<ReturnType<typeof listMembers>>[number];
type Invite = Awaited<ReturnType<typeof listInvites>>[number];

export function ShareView({ round }: { round: Round }) {
  const { config, status, peers } = useCollab();
  const user = useAuth((s) => s.user);
  const cloud = supabaseConfigured();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [msg, setMsg] = useState("");
  const [name, setName] = useState(() => { try { return localStorage.getItem("openflow:name") ?? ""; } catch { return ""; } });
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const live = config?.roundId === round.id;

  const [tick, setTick] = useState(0);
  const reload = async () => setTick((t) => t + 1);
  useEffect(() => {
    if (!cloud || !user) return;
    let on = true;
    (async () => {
      try { const [m, i] = await Promise.all([listMembers(round.id), listInvites(round.id)]); if (on) { setMembers(m); setInvites(i); setMsg(""); } }
      catch (e) { if (on) setMsg(e instanceof Error ? e.message : String(e)); }
    })();
    return () => { on = false; };
  }, [cloud, user, round.id, tick]);

  const start = (transport: "broadcast" | "supabase") => useCollab.getState().start({ roundId: round.id, transport, role: "owner" });
  const copy = (t: string) => { void navigator.clipboard?.writeText(t); useStore.getState().toast("Link copied"); };
  const guard = async (fn: () => Promise<unknown>) => { try { await fn(); await reload(); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold">Share & collaborate</h1>

        <section className="rounded-md border border-line bg-panel p-4">
          <h2 className="mb-1 text-[15px] font-medium">Your name in live sessions</h2>
          <input className="input max-w-xs" value={name} onChange={(e) => { setName(e.target.value); try { localStorage.setItem("openflow:name", e.target.value); } catch {} }} onKeyDown={(e) => e.stopPropagation()} placeholder="Display name" />
          <p className="mt-1 text-[12px] text-muted">Shown on your cursor and presence badge. Applies the next time a session starts.</p>
        </section>

        <section className="rounded-md border border-line bg-panel p-4">
          <h2 className="mb-1 text-[15px] font-medium">Live session</h2>
          {live ? (
            <div className="space-y-2 text-[13px]">
              <p>Status: <b className={status === "live" ? "text-ok" : "text-warn"}>{status}</b> · transport <b>{config?.transport}</b> · you are <b>{config?.role}</b></p>
              <p className="text-muted">Connected: {peers.map((p) => p.name + (p.self ? " (you)" : "")).join(", ") || "just you"}</p>
              <button className="btn" onClick={() => useCollab.getState().stop()}>End live session</button>
            </div>
          ) : (
            <div className="space-y-2 text-[13px]">
              <p className="text-muted">Both partners edit the same flow at once; text in a cell merges character by character, other fields merge per field.</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" disabled={!cloud || !user} title={cloud ? (user ? "" : "Sign in first") : "Supabase is not configured"} onClick={() => start("supabase")}>Start with Supabase Realtime</button>
                <button className="btn" onClick={() => start("broadcast")}>Start same-browser test session</button>
              </div>
              {!cloud && <p className="text-[12px] text-warn">Supabase isn’t configured, so partner links across devices are unavailable. The test session syncs only between tabs of this browser (for trying the feature).</p>}
              {cloud && !user && <p className="text-[12px] text-warn"><Link href="/login" className="underline">Sign in</Link> to share across devices.</p>}
            </div>
          )}
        </section>

        {live && config?.transport === "broadcast" && (
          <section className="rounded-md border border-line bg-panel p-4 text-[13px]">
            <h2 className="mb-1 text-[15px] font-medium">Test links (this browser only)</h2>
            {(["editor", "viewer"] as Role[]).map((r) => { const link = `${origin}/rounds/${round.id}?live=broadcast&role=${r}`; return <div key={r} className="mb-1 flex items-center gap-2"><span className="chip">{r}</span><code className="min-w-0 flex-1 truncate text-[11px] text-muted">{link}</code><button className="btn" onClick={() => copy(link)}>Copy</button></div>; })}
          </section>
        )}

        {cloud && (
          <section className="rounded-md border border-line bg-panel p-4 text-[13px]">
            <h2 className="mb-2 text-[15px] font-medium">Partners & permissions</h2>
            {!user ? <p className="text-muted">Sign in to manage members.</p> : (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  <button className="btn" onClick={() => guard(async () => { await pushRound(round, useStore.getState().args); useStore.getState().toast("Saved to cloud"); })}>Save this round to the cloud</button>
                  {(["editor", "viewer"] as const).map((r) => <button key={r} className="btn" onClick={() => guard(async () => { const t = await createInvite(round.id, r); copy(`${origin}/join/${t}?live=supabase`); })}>New {r} invite link</button>)}
                </div>
                {invites.map((i) => <div key={i.token} className="mb-1 flex items-center gap-2"><span className="chip">{i.role}</span><code className="min-w-0 flex-1 truncate text-[11px] text-muted">{origin}/join/{i.token}</code><button className="btn" onClick={() => copy(`${origin}/join/${i.token}`)}>Copy</button><button className="btn btn-ghost text-bad" onClick={() => guard(() => revokeInvite(i.token))}>Revoke</button></div>)}
                <div className="label mb-1 mt-3">Members</div>
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2 border-t border-line py-1">
                    <span className="flex-1 truncate">{m.profiles?.display_name || m.user_id.slice(0, 8)}{m.user_id === user.id ? " (you)" : ""}</span>
                    {m.role === "owner" ? <span className="chip">owner</span> : (
                      <>
                        <select className="input w-24 py-0.5" value={m.role} onChange={(e) => guard(() => setMemberRole(round.id, m.user_id, e.target.value as Role))}><option value="editor">editor</option><option value="viewer">viewer</option></select>
                        <button className="btn btn-ghost text-bad" onClick={() => guard(() => removeMember(round.id, m.user_id))}>Remove</button>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
            {msg && <p className="mt-2 text-[12px] text-bad">{msg}</p>}
          </section>
        )}
        <p className="text-[11px] text-muted">Roles: <b>owner</b> manages members and deletes the round · <b>editor</b> edits everything · <b>viewer</b> follows live but cannot change anything. Cloud roles are enforced by database row-level security; cloud paths here are not yet verified against a live project.</p>
      </div>
    </div>
  );
}

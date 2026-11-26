"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { listShared } from "@/lib/cloud";
import type { Role } from "@/lib/collab/session";
import { supabaseConfigured } from "@/lib/supabase/client";
import type { Round } from "@/lib/types";
import { ago } from "./RoundList";

export function SharedWithMe() {
  const user = useAuth((s) => s.user);
  const [list, setList] = useState<{ round: Round; role: Role }[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (supabaseConfigured() && user) listShared().then(setList).catch((e) => setErr(e.message)); }, [user]);
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Shared With Me</h1>
      {!supabaseConfigured() ? <p className="text-muted">Sharing across devices needs cloud accounts, which are not configured in this deployment (local mode).</p>
        : !user ? <p className="text-muted"><Link className="text-accent underline" href="/login">Sign in</Link> to see rounds partners have shared with you.</p>
        : err ? <p className="text-bad">{err}</p>
        : !list ? <p className="text-muted">Loading…</p>
        : list.length === 0 ? <p className="text-muted">Nothing shared with you yet. Ask a partner for an invite link.</p>
        : <div className="rounded-md border border-line bg-panel">{list.map(({ round, role }) => <div key={round.id} className="flex items-center gap-3 border-b border-line px-3 py-2"><div className="min-w-0 flex-1"><div className="truncate">{round.title}</div><div className="text-[12px] text-muted">updated {ago(round.updatedAt)}</div></div><span className="chip">{role}</span><Link className="btn" href={`/join-round/${round.id}?role=${role}`}>Open</Link></div>)}</div>}
    </div>
  );
}

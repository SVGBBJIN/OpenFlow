"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { acceptInvite, pullRound } from "@/lib/cloud";
import { useStore } from "@/lib/store";
import { supabaseConfigured } from "@/lib/supabase/client";

export default function Join() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const authReady = useAuth((s) => s.ready);
  const [msg, setMsg] = useState("Joining…");
  useEffect(() => {
    if (!supabaseConfigured() || !authReady || !user) return;
    (async () => {
      try {
        const roundId = await acceptInvite(token);
        const { round, args, role } = await pullRound(roundId);
        await useStore.getState().init();
        await useStore.getState().importRound(round, args);
        router.replace(`/rounds/${roundId}?live=supabase&role=${role}`);
      } catch (e) { setMsg(e instanceof Error ? e.message : "Could not join"); }
    })();
  }, [token, user, authReady, router]);
  if (!supabaseConfigured()) return <p className="p-8 text-muted">Invite links need cloud accounts, which aren’t configured here.</p>;
  if (authReady && !user) return <p className="p-8">Sign in to accept this invite. <Link className="text-accent underline" href="/login">Sign in</Link>, then reopen the link.</p>;
  return <p className="p-8 text-muted">{msg}</p>;
}

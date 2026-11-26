"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { pullRound } from "@/lib/cloud";
import { useStore } from "@/lib/store";

/** Open a shared round: pull its latest rows into local storage, then start the live session. */
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const role = useSearchParams().get("role") ?? "editor";
  const router = useRouter();
  const [msg, setMsg] = useState("Opening…");
  useEffect(() => {
    (async () => {
      try { const { round, args } = await pullRound(id); await useStore.getState().init(); await useStore.getState().importRound(round, args); router.replace(`/rounds/${id}?live=supabase&role=${role}`); }
      catch (e) { setMsg(e instanceof Error ? e.message : "Could not open"); }
    })();
  }, [id, role, router]);
  return <p className="p-8 text-muted">{msg}</p>;
}

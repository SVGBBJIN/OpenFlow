"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { openTransport, startSession, useCollab, type LiveConfig } from "@/lib/collab/session";
import { cloudTransport, pushRound } from "@/lib/cloud";
import { getSupabase } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";

const KEY = "openflow:live";

/** Owns the live-session lifecycle for whichever round is open. Mounted once in the app shell. */
export function CollabHost() {
  const path = usePathname();
  const config = useCollab((s) => s.config);
  const currentId = useStore((s) => s.currentId);

  // Joining via URL (?live=broadcast&role=editor) or resuming after a reload.
  useEffect(() => {
    const m = /^\/rounds\/([^/]+)/.exec(path);
    if (!m || m[1] === "new") return;
    const q = new URLSearchParams(window.location.search);
    const live = q.get("live") as LiveConfig["transport"] | null;
    if (live === "broadcast" || live === "supabase") {
      const role = (q.get("role") === "viewer" ? "viewer" : q.get("role") === "owner" ? "owner" : "editor") as LiveConfig["role"];
      const cfg = { roundId: m[1], transport: live, role };
      if (JSON.stringify(useCollab.getState().config) !== JSON.stringify(cfg)) useCollab.getState().start(cfg);
      return;
    }
    if (!useCollab.getState().config) {
      try { const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as LiveConfig | null; if (saved?.roundId === m[1]) useCollab.getState().start(saved); } catch {}
    }
  }, [path]);

  useEffect(() => {
    if (!config) { try { sessionStorage.removeItem(KEY); } catch {} return; }
    try { sessionStorage.setItem(KEY, JSON.stringify(config)); } catch {}
  }, [config]);

  useEffect(() => {
    if (!config || config.roundId !== currentId) return;
    const transport = openTransport(config, { supabase: () => (getSupabase() ? cloudTransport(config.roundId) : null) });
    if (!transport) { useStore.getState().toast("Live sync needs Supabase to be configured and you signed in."); useCollab.getState().stop(); return; }
    const session = startSession(config, transport);
    // Cloud mode: editors persist the converged state as normalised rows (debounced).
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = config.transport === "supabase" && session.canWrite
      ? useStore.subscribe((s, p) => {
          if (s.args === p.args && s.rounds[config.roundId] === p.rounds[config.roundId]) return;
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => { const st = useStore.getState(); const r = st.rounds[config.roundId]; if (r) void pushRound(r, st.args).catch((e) => st.toast(`Cloud save failed: ${e instanceof Error ? e.message : e}`)); }, 2000);
        })
      : null;
    return () => { unsub?.(); if (timer) clearTimeout(timer); session.destroy(); };
  }, [config, currentId]);

  return null;
}

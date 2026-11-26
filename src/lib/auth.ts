"use client";
import { create } from "zustand";
import { getSupabase } from "./supabase/client";

interface A { user: { id: string; email: string } | null; ready: boolean; init(): void; signOut(): Promise<void> }
let started = false;
export const useAuth = create<A>((set) => ({
  user: null, ready: false,
  init() {
    if (started) return; started = true;
    const sb = getSupabase();
    if (!sb) { set({ ready: true }); return; }
    void sb.auth.getUser().then(({ data }) => set({ user: data.user ? { id: data.user.id, email: data.user.email ?? "" } : null, ready: true }));
    sb.auth.onAuthStateChange((_e, s) => set({ user: s?.user ? { id: s.user.id, email: s.user.email ?? "" } : null }));
  },
  async signOut() { await getSupabase()?.auth.signOut(); set({ user: null }); },
}));

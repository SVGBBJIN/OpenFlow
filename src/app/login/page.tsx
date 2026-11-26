"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  const configured = supabaseConfigured();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase(); if (!sb) return;
    setMsg("Working…");
    const { error } = mode === "in" ? await sb.auth.signInWithPassword({ email, password }) : await sb.auth.signUp({ email, password });
    if (error) return setMsg(error.message);
    if (mode === "up") return setMsg("Check your email to confirm your account, then sign in.");
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-sm p-8">
      <h1 className="mb-2 text-xl font-semibold">{mode === "in" ? "Sign in" : "Create account"}</h1>
      {!configured ? (
        <div className="rounded-md border border-line2 bg-panel p-3 text-[13px] text-muted">
          Cloud accounts are not configured (<code>NEXT_PUBLIC_SUPABASE_URL</code> / <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are unset), so OpenFlow runs in <b className="text-fg">local mode</b>: everything is saved in this browser. <Link href="/" className="text-accent underline">Continue offline</Link>.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <button className="btn btn-primary w-full justify-center">{mode === "in" ? "Sign in" : "Sign up"}</button>
          <button type="button" className="text-[12px] text-accent" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}</button>
          {msg && <p className="text-[12px] text-muted">{msg}</p>}
        </form>
      )}
    </div>
  );
}

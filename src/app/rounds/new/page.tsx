"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Side } from "@/lib/types";

export default function NewRound() {
  const router = useRouter();
  const createRound = useStore((s) => s.createRound);
  const [f, setF] = useState({ title: "", tournament: "", opponent: "", partner: "" });
  const [side, setSide] = useState<Side>("pro");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const go = (e: React.FormEvent) => { e.preventDefault(); router.push(`/rounds/${createRound({ ...f, side })}`); };
  return (
    <form onSubmit={go} className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">New Public Forum round</h1>
      <div className="space-y-3">
        <label className="block"><span className="label">Title</span><input autoFocus className="input mt-1" value={f.title} onChange={set("title")} placeholder="e.g. Round 3 vs. Lincoln HS" /></label>
        <label className="block"><span className="label">Tournament</span><input className="input mt-1" value={f.tournament} onChange={set("tournament")} /></label>
        <div>
          <span className="label">Your side</span>
          <div className="mt-1 flex gap-2">
            {(["pro", "con"] as Side[]).map((s) => (
              <button type="button" key={s} onClick={() => setSide(s)} className={`btn ${side === s ? "btn-primary" : ""}`}>{s === "pro" ? "Pro" : "Con"}</button>
            ))}
          </div>
        </div>
        <label className="block"><span className="label">Debate partner</span><input className="input mt-1" value={f.partner} onChange={set("partner")} placeholder="Name (live invite arrives with collaboration)" /></label>
        <label className="block"><span className="label">Opponent</span><input className="input mt-1" value={f.opponent} onChange={set("opponent")} /></label>
      </div>
      <p className="mt-4 text-[12px] text-muted">Uses the standard eight-speech PF structure. Rename, add or remove speech columns inside the round.</p>
      <div className="mt-4 flex gap-2"><button className="btn btn-primary" type="submit">Create & start flowing</button></div>
    </form>
  );
}

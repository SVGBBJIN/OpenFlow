"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDocs } from "@/lib/docs-store";
import { newId } from "@/lib/flow-ops";
import { layoutFlow } from "@/lib/layout";
import { searchCards } from "@/lib/library";
import { useLib } from "@/lib/lib-store";
import { blankItem, checkPlan, descendantIds, docFromPlan, ensurePlans, moveItem, reorderItem, WEIGH_HELP, type PlanKind } from "@/lib/prep";
import { htmlToText } from "@/lib/sanitize";
import { useStore } from "@/lib/store";
import { WEIGH_MECHANISMS, type Arg, type PlanItem, type Round, type SpeechPlan, type WeighMechanism } from "@/lib/types";
import { Html } from "../RichText";

const stop = (e: React.KeyboardEvent) => { e.stopPropagation(); if (e.key === "Escape") (e.target as HTMLElement).blur(); };
const short = (a: Arg | undefined, n = 70) => (a ? htmlToText(a.text).slice(0, n) || "(empty)" : "(deleted)");

export function PrepBuilder({ kind, round }: { kind: PlanKind; round: Round }) {
  const router = useRouter();
  const args = useStore((s) => s.args);
  const cards = useLib((s) => s.cards);
  const plans = ensurePlans(round);
  const plan = plans[kind];
  const [flowFilter, setFlowFilter] = useState<"all" | "pro" | "con">("all");
  const [q, setQ] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const colOf = (sid: string) => round.speeches.findIndex((s) => s.id === sid);
  const isFF = kind === "finalFocus";

  const setPlan = (fn: (p: SpeechPlan) => SpeechPlan) => useStore.getState().updateRound(round.id, { plans: { ...plans, [kind]: fn(plan) } });
  const setItem = (id: string, p: Partial<PlanItem>) => setPlan((pl) => ({ ...pl, items: pl.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));

  const order = useMemo(() => {
    const out: { arg: Arg; depth: number }[] = [];
    for (const f of ["pro", "con"] as const) for (const id of layoutFlow(args, f, colOf).order) {
      let d = 0, c = args[id]; while (c?.parentId && args[c.parentId]) { d++; c = args[c.parentId]; }
      out.push({ arg: args[id], depth: d });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args, round.speeches]);
  const inPlan = new Set(plan.items.map((i) => i.argId));
  const catalog = order.filter(({ arg }) => (flowFilter === "all" || arg.flow === flowFilter) && (!q || htmlToText(arg.text).toLowerCase().includes(q.toLowerCase())));
  const issues = checkPlan(kind, plans, args);
  const summaryIds = plans.summary.items.map((i) => i.argId);

  const add = (id: string) => !inPlan.has(id) && setPlan((p) => ({ ...p, items: [...p.items, blankItem(id)] }));
  const makeDoc = () => { const d = docFromPlan(kind, round, plan, args, cards); useDocs.getState().put(d); router.push(`/documents/${d.id}`); };

  return (
    <div className="flex h-full">
      <aside className="flex w-80 shrink-0 flex-col border-r border-line bg-panel">
        <div className="space-y-2 border-b border-line p-2">
          <div className="label">Flow arguments</div>
          <div className="flex gap-1">{(["all", "pro", "con"] as const).map((f) => <button key={f} className={`btn px-2 py-0.5 text-[12px] ${flowFilter === f ? "btn-primary" : ""}`} onClick={() => setFlowFilter(f)}>{f}</button>)}</div>
          <input className="input" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={stop} />
          {isFF && <button className="btn w-full justify-center text-[12px]" onClick={() => setPlan((p) => ({ ...p, items: [...p.items, ...summaryIds.filter((id) => !inPlan.has(id) && args[id]).map(blankItem)] }))}>Add everything from my Summary outline</button>}
        </div>
        <div className="flex-1 overflow-auto p-1">
          {catalog.length === 0 && <p className="p-3 text-[13px] text-muted">No arguments yet. Flow some first.</p>}
          {catalog.map(({ arg, depth }) => (
            <div key={arg.id} className="flex items-start gap-1 rounded px-1 py-0.5 text-[12px] hover:bg-raised" style={{ paddingLeft: 4 + Math.min(depth, 4) * 10 }}>
              <span className={`chip ${arg.flow === "pro" ? "text-pro" : "text-con"}`}>{arg.flow[0].toUpperCase()}</span>
              <span className={`min-w-0 flex-1 ${inPlan.has(arg.id) ? "text-muted line-through" : ""}`}>{short(arg, 90)}</span>
              <button className="btn px-1.5 py-0 text-[11px]" disabled={inPlan.has(arg.id)} onClick={() => add(arg.id)}>＋</button>
            </div>
          ))}
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{isFF ? "Final Focus builder" : "Summary builder"}</h1>
            <span className="text-[12px] text-muted">built from your flow — nothing is copied or decided for you</span>
            <button className="btn btn-primary ml-auto" disabled={!plan.items.length} onClick={makeDoc}>Create speech document</button>
          </div>
          {plan.items.length === 0 && <p className="rounded-md border border-dashed border-line2 p-6 text-center text-[13px] text-muted">Add arguments from the left to outline your {isFF ? "Final Focus" : "Summary"}. Order them in the order you will speak.</p>}
          {plan.items.map((it, n) => {
            const a = args[it.argId];
            if (!a) return <div key={it.id} className="rounded border border-bad/50 p-2 text-[12px] text-bad">An argument in this outline was deleted from the flow. <button className="underline" onClick={() => setPlan((p) => ({ ...p, items: p.items.filter((x) => x.id !== it.id) }))}>remove</button></div>;
            const kids = descendantIds(args, a.id);
            const myCards = a.inserts.flatMap((i) => i.entries.filter((e) => e.kind === "card"));
            const opp = Object.values(args).filter((x) => x.flow !== a.flow);
            return (
              <div key={it.id} draggable onDragStart={() => setDragId(it.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) setPlan((p) => reorderItem(p, dragId, it.id)); setDragId(null); }}
                className={`rounded-md border bg-panel p-3 ${issues.some((i) => i.itemId === it.id) ? "border-warn/50" : "border-line"}`} id={`item-${it.id}`}>
                <div className="flex items-start gap-2">
                  <span className="cursor-grab select-none text-muted" title="Drag to reorder">⠿</span>
                  <span className="mt-0.5 w-5 text-[12px] text-muted">{n + 1}.</span>
                  <div className="min-w-0 flex-1"><Html html={a.text} className="text-[14px]" /><div className="mt-0.5 flex gap-1"><span className={`chip ${a.flow === "pro" ? "text-pro" : "text-con"}`}>{a.flow}</span><span className="chip">{a.status}</span></div></div>
                  <div className="flex gap-1"><button className="btn btn-ghost px-1" onClick={() => setPlan((p) => moveItem(p, it.id, -1))}>↑</button><button className="btn btn-ghost px-1" onClick={() => setPlan((p) => moveItem(p, it.id, 1))}>↓</button><button className="btn btn-ghost px-1 text-bad" onClick={() => setPlan((p) => ({ ...p, items: p.items.filter((x) => x.id !== it.id) }))}>×</button></div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
                  <Toggle on={it.offense} label="★ Strongest offense" onClick={() => setItem(it.id, { offense: !it.offense })} />
                  <Toggle on={it.needsDefense} label="⚠ Needs more defense" onClick={() => setItem(it.id, { needsDefense: !it.needsDefense })} />
                  {isFF && <Toggle on={it.voting} label="✔ Voting issue" onClick={() => setItem(it.id, { voting: !it.voting })} />}
                </div>
                {kids.length > 0 && (
                  <div className="mt-2"><div className="label mb-0.5">Attach responses</div>
                    {kids.map((k) => <label key={k} className="flex items-start gap-1.5 text-[12px]"><input type="checkbox" checked={it.responseIds.includes(k)} onChange={() => setItem(it.id, { responseIds: it.responseIds.includes(k) ? it.responseIds.filter((x) => x !== k) : [...it.responseIds, k] })} />
                      <span className={`chip ${args[k].flow === "pro" ? "text-pro" : "text-con"}`}>{args[k].flow[0].toUpperCase()}</span><span>{short(args[k], 100)}</span></label>)}</div>
                )}
                <Evidence item={it} myCards={myCards.map((c) => c.tag)} onChange={(extraCardIds) => setItem(it.id, { extraCardIds })} />
                <div className="mt-2"><div className="label mb-0.5">Weighing</div>
                  {it.weighing.map((w) => (
                    <div key={w.id} className="mb-1 flex gap-1"><select className="input w-32" value={w.mechanism} onChange={(e) => setItem(it.id, { weighing: it.weighing.map((x) => (x.id === w.id ? { ...x, mechanism: e.target.value as WeighMechanism } : x)) })}>{WEIGH_MECHANISMS.map((m) => <option key={m}>{m}</option>)}</select>
                      <input className="input" defaultValue={w.text} placeholder={WEIGH_HELP[w.mechanism]} onKeyDown={stop} onBlur={(e) => setItem(it.id, { weighing: it.weighing.map((x) => (x.id === w.id ? { ...x, text: e.target.value } : x)) })} />
                      <button className="btn btn-ghost px-1" onClick={() => setItem(it.id, { weighing: it.weighing.filter((x) => x.id !== w.id) })}>×</button></div>
                  ))}
                  <div className="flex flex-wrap gap-1">{WEIGH_MECHANISMS.map((m) => <button key={m} title={WEIGH_HELP[m]} className="btn px-1.5 py-0 text-[11px]" onClick={() => setItem(it.id, { weighing: [...it.weighing, { id: newId(), mechanism: m, text: "" }] })}>＋ {m}</button>)}</div></div>
                {isFF && (
                  <div className="mt-2"><div className="label mb-0.5">Compare impacts</div>
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <div className="rounded border border-line p-2"><div className="label">Your impact</div>{a.impact ? <p>{a.impact}</p> : <p className="text-muted">None recorded on the flow (Inspector → Impact comparison).</p>}</div>
                      <div className="rounded border border-line p-2"><div className="label">Opposing</div>
                        {it.opposingIds.map((o) => <div key={o} className="mb-1"><div className="flex gap-1"><span className="min-w-0 flex-1 truncate">{short(args[o], 50)}</span><button className="text-muted hover:text-bad" onClick={() => setItem(it.id, { opposingIds: it.opposingIds.filter((x) => x !== o) })}>×</button></div><p className="text-muted">{args[o]?.impact || "no impact recorded"}</p></div>)}
                        <select className="input" value="" onChange={(e) => e.target.value && setItem(it.id, { opposingIds: [...new Set([...it.opposingIds, e.target.value])] })}><option value="">＋ pick opposing argument…</option>{opp.map((o) => <option key={o.id} value={o.id}>{short(o, 60)}</option>)}</select></div>
                    </div>
                    <textarea className="input mt-1" rows={2} defaultValue={it.comparison} placeholder="Your explicit comparison (why your impact outweighs)…" onKeyDown={stop} onBlur={(e) => setItem(it.id, { comparison: e.target.value })} />
                  </div>
                )}
                <textarea className="input mt-2" rows={1} defaultValue={it.note} placeholder="Speech note…" onKeyDown={stop} onBlur={(e) => e.target.value !== it.note && setItem(it.id, { note: e.target.value })} />
              </div>
            );
          })}
          <div className="rounded-md border border-line bg-panel p-3 space-y-2">
            {!isFF ? <Field label="Weighing overview" value={plan.weighingNotes} onSave={(v) => setPlan((p) => ({ ...p, weighingNotes: v }))} />
              : <><Field label="Impact calculus" value={plan.impactCalculus} onSave={(v) => setPlan((p) => ({ ...p, impactCalculus: v }))} /><Field label="Voting narrative" value={plan.narrative} onSave={(v) => setPlan((p) => ({ ...p, narrative: v }))} rows={4} /></>}
          </div>
        </div>
      </section>

      <aside className="w-72 shrink-0 overflow-auto border-l border-line bg-panel p-3 text-[13px]">
        <div className="label mb-1">Consistency checks</div>
        <p className="mb-2 text-[11px] text-muted">Deterministic checks on what you entered. They don’t judge strategy.</p>
        {issues.length === 0 ? <p className="text-ok">No inconsistencies found.</p> : issues.map((i, k) => (
          <button key={k} className="mb-1.5 block w-full rounded border border-line p-1.5 text-left text-[12px] hover:border-warn" onClick={() => document.getElementById(`item-${i.itemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
            <span className="chip mr-1 text-warn">{i.code}</span>{i.message}
          </button>
        ))}
        {isFF && (
          <div className="mt-4"><div className="label mb-1">Your Summary outline ({summaryIds.length})</div>
            {summaryIds.map((id) => <div key={id} className="flex gap-1 text-[12px]"><span className={`min-w-0 flex-1 truncate ${inPlan.has(id) ? "text-muted" : ""}`}>{short(args[id], 40)}</span>{inPlan.has(id) ? <span className="text-ok">✓</span> : <button className="text-accent" onClick={() => add(id)}>add</button>}</div>)}</div>
        )}
      </aside>
    </div>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick(): void }) {
  return <button onClick={onClick} className={`rounded border px-2 py-0.5 ${on ? "border-accent bg-accent/20 text-fg" : "border-line2 text-muted hover:text-fg"}`}>{label}</button>;
}
function Field({ label, value, onSave, rows = 3 }: { label: string; value: string; onSave(v: string): void; rows?: number }) {
  return <label className="block"><span className="label">{label}</span><textarea className="input mt-1" rows={rows} defaultValue={value} onKeyDown={stop} onBlur={(e) => e.target.value !== value && onSave(e.target.value)} /></label>;
}
function Evidence({ item, myCards, onChange }: { item: PlanItem; myCards: string[]; onChange(ids: string[]): void }) {
  const cards = useLib((s) => s.cards);
  const [q, setQ] = useState("");
  const res = q ? searchCards(Object.values(cards), q).slice(0, 5) : [];
  return (
    <div className="mt-2"><div className="label mb-0.5">Evidence</div>
      <div className="flex flex-wrap gap-1 text-[11px]">
        {myCards.map((t, i) => <span key={i} className="chip" title="Attached on the flow">▤ {t}</span>)}
        {item.extraCardIds.map((id) => <span key={id} className="chip">{cards[id]?.tag ?? "deleted card"} <button onClick={() => onChange(item.extraCardIds.filter((x) => x !== id))}>×</button></span>)}
        {myCards.length + item.extraCardIds.length === 0 && <span className="text-muted">none</span>}
      </div>
      <input className="input mt-1" placeholder="＋ attach card from library…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={stop} />
      {res.map((c) => <button key={c.id} className="mt-0.5 block w-full rounded border border-line px-2 py-0.5 text-left text-[12px] hover:bg-raised" onClick={() => { onChange([...new Set([...item.extraCardIds, c.id])]); setQ(""); }}>{c.tag}</button>)}
    </div>
  );
}

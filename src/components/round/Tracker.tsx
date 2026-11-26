"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ensurePlans, trackerCounts, trackerRows } from "@/lib/prep";
import { useStore } from "@/lib/store";
import { STATUSES, type Round } from "@/lib/types";

export function Tracker({ round }: { round: Round }) {
  const args = useStore((s) => s.args);
  const [flow, setFlow] = useState("");
  const [root, setRoot] = useState("");
  const [speech, setSpeech] = useState("");
  const [status, setStatus] = useState("");
  const [prio, setPrio] = useState("");
  const rows = useMemo(() => trackerRows(args, ensurePlans(round)), [args, round]);
  const counts = useMemo(() => trackerCounts(args, rows), [args, rows]);
  const roots = rows.filter((r) => r.id === r.rootId);
  const shown = rows.filter((r) => (!flow || r.flow === flow) && (!root || r.rootId === root) && (!speech || r.speechId === speech) && (!status || r.status === status) && (!prio || String(r.priority) === prio));
  const sName = (id: string) => round.speeches.find((s) => s.id === id)?.name ?? "?";
  const tiles: [string, number][] = [["Introduced", counts.introduced], ["Responses", counts.responses], ["Extensions", counts.extensions], ["Dropped", counts.dropped], ["Turned", counts.turned], ["Unresolved", counts.unresolved], ["In Summary", counts.inSummary], ["In Final Focus", counts.inFinalFocus]];
  return (
    <div className="h-full overflow-auto p-4">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-[12px] text-muted">Every number below is counted from the statuses, links and outlines <b>you</b> entered. Nothing is inferred.</p>
        <div className="mb-4 grid grid-cols-4 gap-2 md:grid-cols-8">{tiles.map(([l, n]) => <div key={l} className="rounded-md border border-line bg-panel p-2"><div className="text-xl font-semibold">{n}</div><div className="label">{l}</div></div>)}</div>
        <div className="mb-2 flex flex-wrap gap-2">
          <Sel v={flow} set={setFlow} label="Pro or Con" opts={[["pro", "Pro"], ["con", "Con"]]} />
          <Sel v={root} set={setRoot} label="Contention" opts={roots.map((r) => [r.id, r.text.slice(0, 40) || "(empty)"])} />
          <Sel v={speech} set={setSpeech} label="Speech" opts={round.speeches.map((s) => [s.id, s.name])} />
          <Sel v={status} set={setStatus} label="Status" opts={STATUSES.map((s) => [s, s])} />
          <Sel v={prio} set={setPrio} label="Priority" opts={[["0", "none"], ["1", "1"], ["2", "2"], ["3", "3"]]} />
          <span className="ml-auto self-center text-[12px] text-muted">{shown.length} of {rows.length}</span>
        </div>
        <div className="overflow-hidden rounded-md border border-line bg-panel">
          <table className="w-full text-[13px]">
            <thead className="bg-raised text-left text-[11px] uppercase tracking-wide text-muted"><tr><th className="p-2">Argument</th><th>Flow</th><th>Speech</th><th>Status</th><th>Pri</th><th>Resp.</th><th>Ext</th><th>Turn</th><th>Sum</th><th>FF</th></tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-raised">
                <td className="max-w-md p-2"><Link className="hover:text-accent" href={`/rounds/${round.id}?sel=${r.id}`}>{r.text || "(empty)"}</Link></td>
                <td><span className={r.flow === "pro" ? "text-pro" : "text-con"}>{r.flow}</span></td><td>{sName(r.speechId)}</td><td>{r.status}</td><td>{r.priority || "–"}</td><td>{r.responses}</td>
                <td>{r.extended ? "✓" : ""}</td><td>{r.turned ? "✓" : ""}</td><td>{r.inSummary ? "✓" : ""}</td><td>{r.inFinalFocus ? "✓" : ""}</td></tr>))}
              {shown.length === 0 && <tr><td className="p-4 text-muted" colSpan={10}>Nothing matches.</td></tr>}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function Sel({ v, set, label, opts }: { v: string; set(v: string): void; label: string; opts: [string, string][] }) {
  return <select className="input w-auto" value={v} onChange={(e) => set(e.target.value)} aria-label={label}><option value="">{label}: all</option>{opts.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>;
}

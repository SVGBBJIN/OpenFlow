"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { importDocxParagraphs } from "@/lib/docx-import";
import { blankArg } from "@/lib/flow-ops";
import { entriesFromHtmlParagraphs, entryParents, parseSpeechText, type ParsedEntry } from "@/lib/speech-import";
import { htmlToText } from "@/lib/sanitize";
import { useStore } from "@/lib/store";
import type { Arg, Round, Side } from "@/lib/types";

const stop = (e: React.KeyboardEvent) => e.stopPropagation();

interface Row extends ParsedEntry { respondsTo: string }

export function ImportSpeech({ round }: { round: Round }) {
  const router = useRouter();
  const args = useStore((s) => s.args);
  const defaultSpeech = round.speeches.find((s) => s.side !== round.side) ?? round.speeches[0];
  const [speechId, setSpeechId] = useState(defaultSpeech.id);
  const [flow, setFlow] = useState<Side>(defaultSpeech.side);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const toRows = (e: ParsedEntry[]) => setRows(e.map((x) => ({ ...x, respondsTo: "" })));
  const parents = useMemo(() => entryParents(rows), [rows]);
  const existing = Object.values(args).sort((a, b) => a.createdAt - b.createdAt);

  const patch = (i: number, p: Partial<Row>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...p } : r)));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= rows.length) return; const l = [...rows]; [l[i], l[j]] = [l[j], l[i]]; setRows(l); };
  const merge = (i: number) => { if (i === 0) return; const l = [...rows]; const t = l[i - 1]; l[i - 1] = { ...t, text: `${t.text} ${l[i].text}`, html: `<p>${htmlToText(t.html)} ${htmlToText(l[i].html)}</p>` }; l.splice(i, 1); setRows(l); };

  async function fromFile(f: File) {
    setErr("");
    try { const e = entriesFromHtmlParagraphs(await importDocxParagraphs(await f.arrayBuffer())); if (!e.length) throw new Error("No text found in that document"); toRows(e); }
    catch (x) { setErr(x instanceof Error ? x.message : "Could not read file"); }
  }

  const addToFlow = () => {
    const r = round;
    const speechIdx = r.speeches.findIndex((s) => s.id === speechId);
    const created: Arg[] = [];
    const idOf: (string | null)[] = [];
    const lastOrder: Record<string, number> = {};
    rows.forEach((row, i) => {
      const explicit = row.respondsTo || null;
      const parentRow = parents[i];
      const parentId = explicit ?? (parentRow != null ? idOf[parentRow] : null);
      const parent = parentId ? (args[parentId] ?? created.find((c) => c.id === parentId)) : null;
      let col = speechIdx;
      if (parent) col = Math.max(col, r.speeches.findIndex((s) => s.id === parent.speechId));
      const key = parentId ?? `root:${flow}`;
      const siblingsMax = Math.max(0, ...Object.values(args).filter((a) => (a.parentId ?? null) === parentId && (parentId || a.flow === flow)).map((a) => a.order));
      lastOrder[key] = (lastOrder[key] ?? siblingsMax) + 1;
      const a = blankArg(r, { flow: parent ? parent.flow : flow, speechId: r.speeches[col].id, parentId, order: lastOrder[key], text: row.html });
      created.push(a); idOf.push(a.id);
    });
    useStore.getState().addArgs(created);
    useStore.getState().toast(`Added ${created.length} argument${created.length === 1 ? "" : "s"} to the flow`, () => useStore.getState().undo());
    router.push(`/rounds/${round.id}`);
  };

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center gap-2"><h1 className="text-lg font-semibold">Import a speech</h1><span className="chip">deterministic · no AI</span></div>
        <p className="text-[13px] text-muted">Bring in the opponent’s speech (or your own) as editable flow entries. Parsing only splits lines and bullets — you review and correct everything below before it touches the flow.</p>
        <p className="rounded border border-line bg-panel p-2 text-[12px] text-muted"><b className="text-fg">SpeechDrop:</b> importing directly from SpeechDrop is <b>not implemented</b>. Download the speech document from SpeechDrop and upload it here, or paste its text.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label><span className="label">Speech column</span><select className="input mt-1" value={speechId} onChange={(e) => { setSpeechId(e.target.value); const sp = round.speeches.find((s) => s.id === e.target.value); if (sp) setFlow(sp.side); }}>{round.speeches.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label><span className="label">Top-level arguments go on the</span><select className="input mt-1" value={flow} onChange={(e) => setFlow(e.target.value as Side)}><option value="pro">Pro flow</option><option value="con">Con flow</option></select></label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div><span className="label">Paste or type the speech</span><textarea className="input mt-1 min-h-40" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={stop} placeholder={"Contention 1: Economy\n- Growth is up\n    - because of trade"} />
            <button className="btn btn-primary mt-2" disabled={!text.trim()} onClick={() => { setErr(""); toRows(parseSpeechText(text)); }}>Split into entries</button></div>
          <div><span className="label">Or upload a .docx</span><input className="mt-1 block text-[13px]" type="file" accept=".docx" onChange={(e) => e.target.files?.[0] && void fromFile(e.target.files[0])} />
            <button className="btn mt-3" onClick={() => setRows([...rows, { id: `m${Date.now()}`, text: "", html: "<p></p>", depth: 0, respondsTo: "" }])}>＋ Add an entry manually</button></div>
        </div>
        {err && <p className="text-[13px] text-bad">{err}</p>}
        {rows.length > 0 && (
          <div className="rounded-md border border-line bg-panel p-3">
            <div className="mb-2 flex items-center"><h2 className="text-[15px] font-medium">Review &amp; correct ({rows.length} entries)</h2><button className="btn btn-primary ml-auto" disabled={rows.every((r) => !htmlToText(r.html))} onClick={addToFlow}>Add to flow</button></div>
            {rows.map((r, i) => (
              <div key={r.id} className="mb-1 flex items-center gap-1" style={{ paddingLeft: r.depth * 18 }}>
                <button className="btn btn-ghost px-1" title="Outdent" onClick={() => patch(i, { depth: Math.max(0, r.depth - 1) as 0 | 1 | 2 })}>⇤</button>
                <button className="btn btn-ghost px-1" title="Indent (nest under previous)" onClick={() => patch(i, { depth: Math.min(2, r.depth + 1) as 0 | 1 | 2 })}>⇥</button>
                <input className="input" value={r.text} onKeyDown={stop} onChange={(e) => patch(i, { text: e.target.value, html: `<p>${e.target.value.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` })} />
                <select className="input w-44 py-0.5 text-[12px]" value={r.respondsTo} onChange={(e) => patch(i, { respondsTo: e.target.value })} title="Respond to an argument already on the flow">
                  <option value="">{parents[i] != null ? "↳ nested above" : "new contention"}</option>
                  {existing.map((a) => <option key={a.id} value={a.id}>↳ {htmlToText(a.text).slice(0, 30) || "(empty)"}</option>)}
                </select>
                <button className="btn btn-ghost px-1" title="Merge into previous" onClick={() => merge(i)}>⤴</button>
                <button className="btn btn-ghost px-1" onClick={() => move(i, -1)}>↑</button><button className="btn btn-ghost px-1" onClick={() => move(i, 1)}>↓</button>
                <button className="btn btn-ghost px-1 text-bad" onClick={() => setRows(rows.filter((_, k) => k !== i))}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

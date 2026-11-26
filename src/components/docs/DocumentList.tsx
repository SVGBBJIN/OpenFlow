"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDocs } from "@/lib/docs-store";
import { newDoc, TEMPLATES, type TemplateId } from "@/lib/prep";
import { useStore } from "@/lib/store";
import { ago } from "../RoundList";

export function DocumentList() {
  const router = useRouter();
  const docs = useDocs((s) => s.docs);
  const ready = useDocs((s) => s.ready);
  const rounds = useStore((s) => s.rounds);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<TemplateId>("constructive");
  const [roundId, setRoundId] = useState("");
  useEffect(() => { void useDocs.getState().load(); void useStore.getState().init(); }, []);
  const list = Object.values(docs).sort((a, b) => b.updatedAt - a.updatedAt);
  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const d = newDoc({ title, template, roundId: roundId || null, speechName: TEMPLATES[template].label });
    useDocs.getState().put(d);
    router.push(`/documents/${d.id}`);
  };
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-xl font-semibold">Speech Documents</h1>
        <form onSubmit={create} className="mb-6 flex flex-wrap items-end gap-2 rounded-md border border-line bg-panel p-3">
          <label className="min-w-48 flex-1"><span className="label">Title</span><input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pro Summary vs Lincoln" /></label>
          <label><span className="label">Template</span><select className="input mt-1" value={template} onChange={(e) => setTemplate(e.target.value as TemplateId)}>{Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select></label>
          <label><span className="label">Linked round</span><select className="input mt-1" value={roundId} onChange={(e) => setRoundId(e.target.value)}><option value="">None</option>{Object.values(rounds).filter((r) => !r.deletedAt).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
          <button className="btn btn-primary">Create document</button>
        </form>
        <div className="rounded-md border border-line bg-panel">
          {!ready ? <p className="p-4 text-muted">Loading…</p> : list.length === 0 ? <p className="p-4 text-muted">No documents yet. Create one here, or build one from the Summary / Final Focus builder.</p> : list.map((d) => (
            <div key={d.id} className="flex items-center gap-3 border-b border-line px-3 py-2 hover:bg-raised">
              <Link href={`/documents/${d.id}`} className="min-w-0 flex-1"><div className="truncate text-[14px]">{d.title}</div><div className="text-[12px] text-muted">{TEMPLATES[d.template].label} · {d.entries.length} entries{d.roundId && rounds[d.roundId] ? ` · ${rounds[d.roundId].title}` : ""}</div></Link>
              <span className="text-[12px] text-muted">{ago(d.updatedAt)}</span>
              <button className="btn btn-ghost" onClick={() => useDocs.getState().remove(d.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { RoundRow, ago } from "@/components/RoundList";
import { useDocs } from "@/lib/docs-store";
import { useEffect } from "react";

export default function Dashboard() {
  const { rounds, ready, createRound } = useStore();
  const router = useRouter();
  const docs = useDocs((s) => s.docs);
  useEffect(() => { void useDocs.getState().load(); }, []);
  const recentDocs = Object.values(docs).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  const list = Object.values(rounds).filter((r) => !r.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <div className="flex gap-2">
            <Link href="/rounds/new" className="btn">New round…</Link>
            <button className="btn btn-primary" onClick={() => router.push(`/rounds/${createRound({})}`)}>Quick-create round</button>
          </div>
        </div>
        {list[0] && (
          <Link href={`/rounds/${list[0].id}`} className="mb-6 flex items-center justify-between rounded-md border border-line2 bg-panel p-4 hover:border-accent">
            <div>
              <div className="label">Resume last round</div>
              <div className="text-[15px]">{list[0].title}</div>
            </div>
            <span className="btn btn-primary">Resume →</span>
          </Link>
        )}
        <h2 className="label mb-2">Recent rounds</h2>
        <div className="rounded-md border border-line bg-panel">
          {!ready ? <p className="p-4 text-muted">Loading…</p> : list.length === 0 ? (
            <p className="p-4 text-muted">No rounds yet. Quick-create one and start flowing — press <span className="kbd">Enter</span> to add your first argument.</p>
          ) : list.slice(0, 6).map((r) => <RoundRow key={r.id} r={r} />)}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-line bg-panel p-3">
            <div className="label mb-1">Recently edited flows</div>
            {list.slice(0, 4).map((r) => <Link key={r.id} href={`/rounds/${r.id}`} className="flex justify-between py-0.5 text-[13px] hover:text-accent"><span className="truncate">{r.title}</span><span className="text-muted">{ago(r.updatedAt)}</span></Link>)}
            {list.length === 0 && <p className="text-[13px] text-muted">None yet.</p>}
          </div>
          <div className="rounded-md border border-line bg-panel p-3">
            <div className="label mb-1">Recent speech documents</div>
            {recentDocs.map((d) => <Link key={d.id} href={`/documents/${d.id}`} className="flex justify-between py-0.5 text-[13px] hover:text-accent"><span className="truncate">{d.title}</span><span className="text-muted">{ago(d.updatedAt)}</span></Link>)}
            {recentDocs.length === 0 && <p className="text-[13px] text-muted">None yet.</p>}
          </div>
          <div className="rounded-md border border-line bg-panel p-3 md:col-span-2">
            <div className="label mb-1">Shared rounds</div>
            <p className="text-[13px] text-muted">Rounds partners share with you appear under <Link className="text-accent underline" href="/shared">Shared With Me</Link> (needs cloud accounts).</p>
          </div>
        </div>
      </div>
    </div>
  );
}

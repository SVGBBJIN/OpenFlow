"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { RoundRow } from "@/components/RoundList";

export default function Dashboard() {
  const { rounds, ready, createRound } = useStore();
  const router = useRouter();
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
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Shared rounds", "Partner collaboration arrives in Phase 4."],
            ["Speech documents", "Document builder arrives in Phase 3."],
            ["Evidence & blocks", "Libraries arrive in Phase 2."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-md border border-line bg-panel p-3">
              <div className="label">{t}</div>
              <p className="mt-1 text-[13px] text-muted">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

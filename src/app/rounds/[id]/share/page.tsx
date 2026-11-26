"use client";
import { useParams } from "next/navigation";
import { RoundShell } from "@/components/round/RoundShell";
import { ShareView } from "@/components/round/ShareView";
import { useStore } from "@/lib/store";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const round = useStore((s) => s.rounds[id]);
  return <RoundShell roundId={id} active="share">{round && <ShareView round={round} />}</RoundShell>;
}

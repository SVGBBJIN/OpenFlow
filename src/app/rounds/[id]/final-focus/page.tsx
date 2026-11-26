"use client";
import { useParams } from "next/navigation";
import { PrepBuilder } from "@/components/round/PrepBuilder";
import { RoundShell } from "@/components/round/RoundShell";
import { useStore } from "@/lib/store";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const round = useStore((s) => s.rounds[id]);
  return <RoundShell roundId={id} active="final-focus">{round && <PrepBuilder kind="finalFocus" round={round} />}</RoundShell>;
}

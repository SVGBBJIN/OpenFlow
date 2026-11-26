"use client";
import { useParams } from "next/navigation";
import { RoundShell } from "@/components/round/RoundShell";
import { Tracker } from "@/components/round/Tracker";
import { useStore } from "@/lib/store";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const round = useStore((s) => s.rounds[id]);
  return <RoundShell roundId={id} active="tracker">{round && <Tracker round={round} />}</RoundShell>;
}

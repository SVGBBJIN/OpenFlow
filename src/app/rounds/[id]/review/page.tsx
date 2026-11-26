"use client";
import { useParams } from "next/navigation";
import { ReviewView } from "@/components/round/ReviewView";
import { RoundShell } from "@/components/round/RoundShell";
import { useStore } from "@/lib/store";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const round = useStore((s) => s.rounds[id]);
  return <RoundShell roundId={id} active="review">{round && <ReviewView round={round} />}</RoundShell>;
}

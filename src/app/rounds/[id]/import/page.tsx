"use client";
import { useParams } from "next/navigation";
import { ImportSpeech } from "@/components/round/ImportSpeech";
import { RoundShell } from "@/components/round/RoundShell";
import { useStore } from "@/lib/store";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const round = useStore((s) => s.rounds[id]);
  return <RoundShell roundId={id} active="import">{round && <ImportSpeech round={round} />}</RoundShell>;
}

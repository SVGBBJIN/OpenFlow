"use client";
import { useParams } from "next/navigation";
import { FlowEditor } from "@/components/FlowEditor";

export default function RoundPage() {
  const { id } = useParams<{ id: string }>();
  return <FlowEditor roundId={id} />;
}

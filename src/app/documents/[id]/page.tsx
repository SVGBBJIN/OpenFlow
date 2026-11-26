"use client";
import { useParams } from "next/navigation";
import { DocumentEditor } from "@/components/docs/DocumentEditor";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <DocumentEditor docId={id} />;
}

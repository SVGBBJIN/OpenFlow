import type { Insert, InsertEntry } from "./types";
import { newId } from "./flow-ops";

export interface EvidenceCard {
  id: string;
  tag: string;
  author: string;
  publication: string;
  /** Free text or ISO date as published. */
  date: string;
  url: string;
  /** Full source text. Highlighted evidence = the <mark> runs inside it. */
  bodyHtml: string;
  citation: string;
  notes: string;
  topic: string;
  contention: string;
  folderId: string | null;
  tags: string[];
  collections: string[];
  createdAt: number;
  updatedAt: number;
}

export type Scope = "evidence" | "blocks";
export interface Folder { id: string; scope: Scope; name: string; parentId: string | null; kind: "folder" | "file" }

export const BLOCK_KINDS = [
  "constructive", "rebuttal", "frontline", "extension", "summary", "finalFocus", "turn", "defense", "weighing", "topicFile",
] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
export const BLOCK_KIND_LABEL: Record<BlockKind, string> = {
  constructive: "Constructive", rebuttal: "Rebuttal", frontline: "Frontline", extension: "Extension",
  summary: "Summary", finalFocus: "Final Focus", turn: "Turn", defense: "Defense", weighing: "Weighing", topicFile: "Topic file",
};

export interface BlockEntry { id: string; type: "card" | "text"; cardId: string | null; html: string }
export interface Block {
  id: string;
  /** Slash name, e.g. "econ" → /econ */
  name: string;
  kind: BlockKind;
  topic: string;
  folderId: string | null;
  entries: BlockEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface LibraryData { cards: EvidenceCard[]; folders: Folder[]; blocks: Block[] }

export function blankCard(over: Partial<EvidenceCard> = {}): EvidenceCard {
  const now = Date.now();
  return {
    id: newId(), tag: "", author: "", publication: "", date: "", url: "", bodyHtml: "", citation: "", notes: "",
    topic: "", contention: "", folderId: null, tags: [], collections: [], createdAt: now, updatedAt: now, ...over,
  };
}
export function blankBlock(over: Partial<Block> = {}): Block {
  const now = Date.now();
  return { id: newId(), name: "new-block", kind: "constructive", topic: "", folderId: null, entries: [], createdAt: now, updatedAt: now, ...over };
}

/** Citation shown when the user has not typed one: "Author, Publication, Date". Deterministic. */
export function autoCitation(c: Pick<EvidenceCard, "author" | "publication" | "date" | "url">): string {
  return [c.author, c.publication, c.date].filter(Boolean).join(", ") + (c.url ? ` (${c.url})` : "");
}

/** Only the highlighted runs (what the debater would read aloud). */
export function highlightedText(html: string): string {
  const out: string[] = [];
  for (const m of html.matchAll(/<mark>([\s\S]*?)<\/mark>/g)) out.push(m[1].replace(/<[^>]+>/g, ""));
  return out.join(" … ");
}

export function searchCards(cards: EvidenceCard[], q: string): EvidenceCard[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return cards;
  return cards.filter((c) => {
    const hay = [c.tag, c.author, c.publication, c.date, c.citation, c.topic, c.contention, c.notes, c.tags.join(" "), c.collections.join(" "), c.bodyHtml.replace(/<[^>]+>/g, " ")].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export function cardToInsertEntry(c: EvidenceCard): InsertEntry {
  return { id: newId(), cardId: c.id, tag: c.tag, citation: c.citation || autoCitation(c), html: c.bodyHtml, kind: "card" };
}

/** Snapshot a block for insertion: card order, citations, highlighting and formatting are copied verbatim. */
export function blockToInsert(b: Block, cards: Record<string, EvidenceCard>): { insert: Insert; missing: number } {
  let missing = 0;
  const entries: InsertEntry[] = [];
  for (const e of b.entries) {
    if (e.type === "text") entries.push({ id: newId(), cardId: null, tag: "", citation: "", html: e.html, kind: "text" });
    else {
      const c = e.cardId ? cards[e.cardId] : undefined;
      if (!c) { missing++; continue; }
      entries.push(cardToInsertEntry(c));
    }
  }
  return { insert: { id: newId(), blockId: b.id, name: b.name, entries, at: Date.now() }, missing };
}

export function slugBlockName(s: string): string {
  return s.trim().toLowerCase().replace(/^\/+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "block";
}

export function descendantsOf(folders: Folder[], id: string): string[] {
  const out = [id];
  for (const f of folders) if (f.parentId === id) out.push(...descendantsOf(folders, f.id));
  return out;
}

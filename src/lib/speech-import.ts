import { htmlToText } from "./sanitize";

export interface ParsedEntry { id: string; text: string; html: string; depth: 0 | 1 | 2 }

const BULLET = /^\s*(?:[-–—•*▪◦·]|\d+[.)]|[a-z][.)])\s+/;
const HEADING = /^\s*(?:contention|observation|framework|argument|response|off|their|our|c\d+|a\d+)\b[^\n]{0,80}[:.]?\s*$/i;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let n = 0;
const uid = () => `p${++n}`;

/**
 * Deterministic speech → flow-entry parser. One entry per non-empty line. Depth comes from bullets/indentation:
 * unindented lines (and “Contention …” style headings) are depth 0; bullets or indentation nest one level deeper.
 * Never interprets meaning — the user corrects the result before anything reaches the flow.
 */
export function parseSpeechText(raw: string): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  for (const line of raw.replace(/\r/g, "").split("\n")) {
    if (!line.trim()) continue;
    const indent = (line.match(/^[ \t]*/)?.[0] ?? "").replace(/\t/g, "    ").length;
    const bulleted = BULLET.test(line);
    const text = line.replace(BULLET, "").trim();
    let depth = Math.min(2, (bulleted ? 1 : 0) + Math.floor(indent / 4)) as 0 | 1 | 2;
    if (HEADING.test(text) && !bulleted && indent === 0) depth = 0;
    if (!out.length) depth = 0;
    out.push({ id: uid(), text, html: `<p>${esc(text)}</p>`, depth });
  }
  return out;
}

export function entriesFromHtmlParagraphs(paras: { html: string; text: string; bullet: boolean; indent: number }[]): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  for (const p of paras) {
    if (!p.text.trim()) continue;
    let depth: 0 | 1 | 2 = p.bullet || p.indent > 0 ? (p.indent >= 2 ? 2 : 1) : 0;
    if (!out.length) depth = 0;
    out.push({ id: uid(), text: p.text, html: p.html, depth });
  }
  return out;
}

/** Resolve depths into parent links: each entry's parent is the nearest previous entry with a smaller depth. */
export function entryParents(entries: ParsedEntry[]): (number | null)[] {
  const stack: number[] = [];
  return entries.map((e, i) => {
    while (stack.length && entries[stack[stack.length - 1]].depth >= e.depth) stack.pop();
    const parent = stack.length ? stack[stack.length - 1] : null;
    stack.push(i);
    return parent;
  });
}

export const plainOf = (e: ParsedEntry) => htmlToText(e.html);

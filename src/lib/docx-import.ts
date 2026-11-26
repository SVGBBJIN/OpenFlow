import JSZip from "jszip";
import { sanitizeHtml } from "./sanitize";
import { parseCitation } from "./cite";
import type { EvidenceCard } from "./library";

interface Run { text: string; b: boolean; i: boolean; u: boolean; s: boolean; hl: boolean }
interface Para { style: string; runs: Run[]; bullet?: boolean; ilvl?: number }

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const flag = (el: Element | null, tag: string) => {
  const t = el?.getElementsByTagNameNS(W, tag)[0];
  if (!t) return false;
  const v = t.getAttributeNS(W, "val");
  return v !== "0" && v !== "false" && v !== "none";
};

export async function readDocxParagraphs(data: ArrayBuffer | Uint8Array): Promise<Para[]> {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("Not a .docx file (word/document.xml missing)");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const paras: Para[] = [];
  for (const p of Array.from(doc.getElementsByTagNameNS(W, "p"))) {
    const style = p.getElementsByTagNameNS(W, "pStyle")[0]?.getAttributeNS(W, "val") ?? "";
    const numPr = p.getElementsByTagNameNS(W, "numPr")[0];
    const ilvl = Number(numPr?.getElementsByTagNameNS(W, "ilvl")[0]?.getAttributeNS(W, "val") ?? 0);
    const runs: Run[] = [];
    for (const r of Array.from(p.getElementsByTagNameNS(W, "r"))) {
      const rpr = r.getElementsByTagNameNS(W, "rPr")[0] ?? null;
      let text = "";
      for (const n of Array.from(r.childNodes)) {
        const el = n as Element;
        if (el.localName === "t") text += el.textContent ?? "";
        else if (el.localName === "tab") text += "\t";
        else if (el.localName === "br") text += "\n";
      }
      if (!text) continue;
      runs.push({ text, b: flag(rpr, "b"), i: flag(rpr, "i"), u: flag(rpr, "u"), s: flag(rpr, "strike"), hl: flag(rpr, "highlight") });
    }
    paras.push({ style, runs, bullet: !!numPr || /list/i.test(style), ilvl });
  }
  return paras;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function runsToHtml(runs: Run[]): string {
  let out = "";
  for (const r of runs) {
    let h = esc(r.text).replace(/\n/g, "<br>");
    if (r.b) h = `<b>${h}</b>`;
    if (r.i) h = `<i>${h}</i>`;
    if (r.u) h = `<u>${h}</u>`;
    if (r.s) h = `<s>${h}</s>`;
    if (r.hl) h = `<mark>${h}</mark>`;
    out += h;
  }
  return out;
}
const plain = (p: Para) => p.runs.map((r) => r.text).join("").trim();
const level = (style: string) => /^Heading([1-9])$/i.exec(style.replace(/\s/g, ""))?.[1];
const CITE_HINT = /\b(?:19|20)\d{2}\b|\[[^\]]+\]|https?:\/\//;

/**
 * Debate-file import. Deterministic rules (Verbatim-style): Heading 1 → topic, Heading 2/3 → contention,
 * Heading 4 → card tag. The paragraph after a tag that looks like a citation (year / brackets / URL) is the
 * citation; remaining paragraphs until the next heading are the body, keeping bold/underline/strike/highlight.
 */
export function paragraphsToCards(paras: Para[]): Partial<EvidenceCard>[] {
  const cards: Partial<EvidenceCard>[] = [];
  let topic = "", contention = "";
  let cur: { tag: string; cite: string; body: string[]; topic: string; contention: string } | null = null;
  const flush = () => {
    if (!cur) return;
    const parsed = cur.cite ? parseCitation(cur.cite) : { author: "", date: "", url: "", publication: "" };
    cards.push({ tag: cur.tag, citation: cur.cite, bodyHtml: sanitizeHtml(cur.body.map((b) => `<p>${b}</p>`).join("")), topic: cur.topic, contention: cur.contention, ...parsed });
    cur = null;
  };
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    const lv = level(p.style);
    const text = plain(p);
    if (lv && +lv <= 3) { flush(); if (lv === "1") { topic = text; contention = ""; } else contention = text; continue; }
    if (lv === "4") { flush(); cur = { tag: text, cite: "", body: [], topic, contention }; continue; }
    if (!cur || !text) continue;
    if (!cur.cite && cur.body.length === 0 && text.length <= 500 && CITE_HINT.test(text)) { cur.cite = text; continue; }
    cur.body.push(runsToHtml(p.runs));
  }
  flush();
  return cards;
}

export async function importDocx(data: ArrayBuffer | Uint8Array) {
  return paragraphsToCards(await readDocxParagraphs(data));
}

/** Paragraphs for speech import: html (formatting kept), plain text, bullet flag and list level. */
export async function importDocxParagraphs(data: ArrayBuffer | Uint8Array) {
  return (await readDocxParagraphs(data)).map((p) => ({ html: `<p>${runsToHtml(p.runs)}</p>`, text: plain(p), bullet: !!p.bullet, indent: p.ilvl ?? 0 }));
}

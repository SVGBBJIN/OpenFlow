import { sanitizeHtml } from "./sanitize";
import type { EvidenceCard } from "./library";

export interface ParsedCite { author: string; date: string; url: string; publication: string }

const YEAR = /\b(?:19|20)\d{2}\b/;
const URL_RE = /https?:\/\/[^\s)>\]]+/;

/**
 * Deterministic citation parsing (no AI): "Smith 21, Brookings (2021)…", "Jane Smith [Brookings, 2021]",
 * "Smith, 2021, https://…". Anything unrecognised is left blank for the user to fill in.
 */
export function parseCitation(text: string): ParsedCite {
  const t = text.replace(/\s+/g, " ").trim();
  const url = t.match(URL_RE)?.[0] ?? "";
  const year = t.match(YEAR)?.[0] ?? "";
  const short = t.match(/^([A-Z][A-Za-z.'’-]+(?:\s+(?:and|&)\s+[A-Z][A-Za-z.'’-]+|\s+et al\.?)?)[\s,]+['’]?(\d{2})\b/);
  const lead = t.match(/^([A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){0,2})(?=[\s,\[(]*(?:\d{2,4}|\[|\())/);
  const author = (short?.[1] ?? lead?.[1] ?? "").trim();
  const date = year || (short ? `20${short[2]}` : "");
  const pubMatch = t.match(/[\[(,]\s*([A-Z][A-Za-z&.'’ -]{2,40}?)\s*[,)\]]/);
  const publication = pubMatch && pubMatch[1] !== author && !YEAR.test(pubMatch[1]) ? pubMatch[1].trim() : "";
  return { author, date, url, publication };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const textToHtml = (t: string) =>
  t.split(/\n{2,}/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");

/**
 * Turn pasted text into a card. Rules: blank-line separated blocks; block 1 = tag if short,
 * next block = citation if it contains a year or URL, the rest = body. Otherwise everything is body.
 */
export function parsePastedText(raw: string): Partial<EvidenceCard> {
  const blocks = raw.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (!blocks.length) return {};
  let i = 0;
  let tag = "";
  let citation = "";
  if (blocks.length > 1 && blocks[0].length <= 220 && !blocks[0].includes("\n")) { tag = blocks[0]; i = 1; }
  if (blocks.length > i + 1 && blocks[i].length <= 400 && (YEAR.test(blocks[i]) || URL_RE.test(blocks[i]))) { citation = blocks[i].replace(/\s+/g, " "); i++; }
  const body = blocks.slice(i).join("\n\n");
  if (!tag) tag = body.split(/\s+/).slice(0, 10).join(" ");
  const parsed = citation ? parseCitation(citation) : { author: "", date: "", url: "", publication: "" };
  return { tag, citation, bodyHtml: sanitizeHtml(textToHtml(body)), ...parsed };
}

/** Deterministic metadata + paragraph extraction from fetched HTML. */
export function parseWebPage(html: string, url: string): Partial<EvidenceCard> {
  const meta = (names: string[]) => {
    for (const n of names) {
      const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]*content=["']([^"']*)["']`, "i"))
        ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${n}["']`, "i"));
      if (m?.[1]) return decode(m[1]);
    }
    return "";
  };
  const title = meta(["og:title", "twitter:title"]) || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const author = meta(["author", "article:author", "parsely-author"]);
  const publication = meta(["og:site_name", "application-name"]);
  const date = (meta(["article:published_time", "date", "pubdate", "og:article:published_time"]) || html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] || "").slice(0, 10);
  const scope = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  const cleaned = scope.replace(/<(script|style|nav|footer|header|aside|noscript)[\s\S]*?<\/\1>/gi, "");
  const paras = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40);
  const body = paras.map((p) => `<p>${esc(p)}</p>`).join("");
  return { tag: title, author, publication, date, url, bodyHtml: body, citation: [author, publication, date].filter(Boolean).join(", ") + ` (${url})` };
}

function decode(s: string): string {
  return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

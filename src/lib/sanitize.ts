const ALLOWED = new Set(["b", "strong", "i", "em", "s", "strike", "mark", "br", "p"]);

/** Deterministic allow-list sanitiser for the inline HTML we store. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (m, tag: string) => {
      const t = tag.toLowerCase();
      if (!ALLOWED.has(t)) return "";
      return m.startsWith("</") ? `</${t}>` : `<${t}>`;
    })
    .replace(/<(?!\/?(?:b|strong|i|em|s|strike|mark|br|p)>)/gi, "&lt;");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

export function isEmptyHtml(html: string): boolean {
  return htmlToText(html) === "";
}

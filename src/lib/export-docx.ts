import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

export type ExportNode =
  | { type: "title"; text: string }
  | { type: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { type: "html"; html: string }
  | { type: "card"; tag: string; citation: string; html: string }
  | { type: "table"; rows: string[][] };

interface Style { b?: boolean; i?: boolean; u?: boolean; s?: boolean; hl?: boolean }

function runsFrom(node: Node, st: Style, out: TextRun[]) {
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      const text = n.textContent ?? "";
      if (text) out.push(new TextRun({ text, bold: st.b, italics: st.i, underline: st.u ? {} : undefined, strike: st.s, highlight: st.hl ? "yellow" : undefined }));
    } else if (n.nodeType === 1) {
      const el = n as HTMLElement;
      const t = el.tagName.toLowerCase();
      if (t === "br") { out.push(new TextRun({ break: 1 })); return; }
      runsFrom(el, {
        b: st.b || t === "b" || t === "strong", i: st.i || t === "i" || t === "em", u: st.u || t === "u",
        s: st.s || t === "s" || t === "strike", hl: st.hl || t === "mark",
      }, out);
    }
  });
}

/** Sanitised inline HTML → paragraphs, preserving bold / italic / underline / strike / highlight. */
export function htmlToParagraphs(html: string, base: Style = {}): Paragraph[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const blocks = Array.from(doc.body.children).filter((c) => c.tagName.toLowerCase() === "p");
  const sources: Node[] = blocks.length ? blocks : [doc.body];
  return sources.map((b) => {
    const runs: TextRun[] = [];
    runsFrom(b, base, runs);
    return new Paragraph({ children: runs, spacing: { after: 120 } });
  });
}

const HEAD = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4 } as const;

export function buildDocument(nodes: ExportNode[]): Document {
  const children: (Paragraph | Table)[] = [];
  for (const n of nodes) {
    if (n.type === "title") children.push(new Paragraph({ text: n.text, heading: HeadingLevel.TITLE, alignment: AlignmentType.LEFT }));
    else if (n.type === "heading") children.push(new Paragraph({ text: n.text, heading: HEAD[n.level] }));
    else if (n.type === "html") children.push(...htmlToParagraphs(n.html));
    else if (n.type === "card") {
      children.push(new Paragraph({ text: n.tag, heading: HeadingLevel.HEADING_4 }));
      if (n.citation) children.push(new Paragraph({ children: [new TextRun({ text: n.citation, bold: true })], spacing: { after: 80 } }));
      children.push(...htmlToParagraphs(n.html));
    } else if (n.type === "table") {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: n.rows.map((r, ri) => new TableRow({ children: r.map((c) => new TableCell({ children: c.split("\n").map((l) => new Paragraph({ children: [new TextRun({ text: l, bold: ri === 0, size: 18 })] })) })) })),
      }));
      children.push(new Paragraph({ text: "" }));
    }
  }
  return new Document({ sections: [{ children }] });
}

export async function docxBlob(nodes: ExportNode[]): Promise<Blob> {
  return Packer.toBlob(buildDocument(nodes));
}
export async function docxBytes(nodes: ExportNode[]): Promise<Uint8Array> {
  return new Uint8Array(await Packer.toBuffer(buildDocument(nodes)));
}

export function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const safeName = (s: string) => (s.trim().replace(/[^\w.-]+/g, "_").slice(0, 60) || "openflow");

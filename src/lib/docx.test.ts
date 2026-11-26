// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { docxBytes } from "./export-docx";
import { importDocx } from "./docx-import";

describe("docx round trip", () => {
  it("export → import preserves tag, citation, topic, highlighting and formatting", async () => {
    const bytes = await docxBytes([
      { type: "heading", level: 1, text: "Trade topic" },
      { type: "heading", level: 3, text: "Contention 1: growth" },
      { type: "card", tag: "Tariffs cut GDP", citation: "Lee 22, CATO (2022)", html: "<p>Before <mark>highlighted <b>bold</b></mark> after <u>under</u> <s>struck</s></p><p>second para</p>" },
      { type: "card", tag: "Second card", citation: "Kim 20 https://x.org", html: "<p>plain</p>" },
    ]);
    const cards = await importDocx(bytes);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ tag: "Tariffs cut GDP", citation: "Lee 22, CATO (2022)", topic: "Trade topic", contention: "Contention 1: growth", author: "Lee", date: "2022" });
    expect(cards[0].bodyHtml!).toContain("<mark>highlighted </mark>");
    expect(cards[0].bodyHtml!).toMatch(/<mark><b>bold<\/b><\/mark>/);
    expect(cards[0].bodyHtml!).toContain("<u>under</u>");
    expect(cards[0].bodyHtml!).toContain("<s>struck</s>");
    expect(cards[0].bodyHtml!.match(/<p>/g)).toHaveLength(2);
    expect(cards[1].url).toBe("https://x.org");
  });
});

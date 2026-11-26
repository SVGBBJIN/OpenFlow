import { describe, expect, it } from "vitest";
import { blankBlock, blankCard, blockToInsert, highlightedText, searchCards, slugBlockName } from "./library";
import { parseCitation, parsePastedText, parseWebPage } from "./cite";

describe("citations", () => {
  it("parses short cites", () => {
    expect(parseCitation("Smith 21, Brookings (2021)")).toMatchObject({ author: "Smith", date: "2021" });
    expect(parseCitation("Jane Doe [Foreign Affairs, 2019] https://x.org/a")).toMatchObject({ author: "Jane Doe", date: "2019", url: "https://x.org/a" });
  });
  it("pasted text -> tag / cite / body", () => {
    const c = parsePastedText("Tariffs hurt growth\n\nLee 22, CATO (2022)\n\nTariffs raise prices.\n\nThey also cut exports.");
    expect(c.tag).toBe("Tariffs hurt growth");
    expect(c.author).toBe("Lee");
    expect(c.bodyHtml).toContain("<p>Tariffs raise prices.</p>");
  });
  it("web page extraction is deterministic", () => {
    const html = `<html><head><title>T</title><meta name="author" content="A B"><meta property="og:site_name" content="Site"></head><body><article><p>${"word ".repeat(20)}</p><script>x</script></article></body></html>`;
    const c = parseWebPage(html, "https://e.com/a");
    expect(c).toMatchObject({ tag: "T", author: "A B", publication: "Site" });
    expect(c.bodyHtml).toContain("word");
  });
});

describe("library", () => {
  it("highlightedText extracts mark runs only", () => {
    expect(highlightedText("<p>a <mark>b</mark> c <mark>d</mark></p>")).toBe("b … d");
  });
  it("search matches across fields", () => {
    const a = blankCard({ tag: "Econ growth", author: "Kim" });
    const b = blankCard({ tag: "Climate", topic: "env" });
    expect(searchCards([a, b], "kim econ")).toEqual([a]);
  });
  it("block insert preserves order, citation and highlighting, and reports missing cards", () => {
    const c1 = blankCard({ tag: "one", citation: "Kim 20", bodyHtml: "<p><mark>hi</mark></p>" });
    const c2 = blankCard({ tag: "two", citation: "Lee 21", bodyHtml: "<p>x</p>" });
    const b = blankBlock({ entries: [
      { id: "1", type: "card", cardId: c2.id, html: "" }, { id: "2", type: "text", cardId: null, html: "<p>say this</p>" },
      { id: "3", type: "card", cardId: c1.id, html: "" }, { id: "4", type: "card", cardId: "gone", html: "" } ] });
    const { insert, missing } = blockToInsert(b, { [c1.id]: c1, [c2.id]: c2 });
    expect(insert.entries.map((e) => e.tag || e.html)).toEqual(["two", "<p>say this</p>", "one"]);
    expect(insert.entries[2].html).toContain("<mark>hi</mark>");
    expect(insert.entries[0].cardId).toBe(c2.id);
    expect(missing).toBe(1);
  });
  it("slug", () => expect(slugBlockName("/Econ Growth!")).toBe("econ-growth"));
});

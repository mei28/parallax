// @vitest-environment jsdom
// Which text nodes get sent to the translator.
//
// Every rejection here saves a sequential translate() call, and the measured cost of one is
// roughly 29 ms, so the skip list is a performance feature as much as a correctness one.
import { afterEach, describe, expect, it } from "vitest";
import { collectTextNodes } from "../../src/content/text-nodes.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

function collect(html: string): string[] {
  document.body.innerHTML = html;
  return collectTextNodes(document.body).map((node) => node.data.trim());
}

describe("collectTextNodes", () => {
  it("collects prose in document order", () => {
    expect(collect("<h1>Title</h1><p>Body</p>")).toEqual(["Title", "Body"]);
  });

  it("collects text split across inline elements", () => {
    expect(collect("<p>Hello <b>bold</b> world</p>")).toEqual(["Hello", "bold", "world"]);
  });

  it("skips script and style, whose text is not prose", () => {
    expect(collect("<script>var a = 1</script><style>p{color:red}</style><p>Kept</p>")).toEqual([
      "Kept",
    ]);
  });

  it("skips code and pre, where translating identifiers destroys the meaning", () => {
    expect(collect("<pre>const x = 1</pre><p>Prose <code>flatMap</code> here</p>")).toEqual([
      "Prose",
      "here",
    ]);
  });

  it("skips text nested deep inside a skipped element", () => {
    expect(collect("<pre><span><em>still code</em></span></pre><p>Kept</p>")).toEqual(["Kept"]);
  });

  it("honours the author's translate=no opt-out, for the whole subtree", () => {
    expect(collect('<div translate="no"><p>Leave me</p></div><p>Kept</p>')).toEqual(["Kept"]);
  });

  it("honours the notranslate class", () => {
    expect(collect('<p class="notranslate">Leave me</p><p>Kept</p>')).toEqual(["Kept"]);
  });

  it("skips aria-hidden content, which is usually an icon ligature", () => {
    expect(collect('<i aria-hidden="true">menu_open</i><p>Kept</p>')).toEqual(["Kept"]);
  });

  it("skips editable regions, which hold the user's own text", () => {
    expect(collect('<div contenteditable="true">My draft</div><p>Kept</p>')).toEqual(["Kept"]);
  });

  it("skips whitespace-only nodes", () => {
    expect(collect("<p>Kept</p>\n  \n<p>Also kept</p>")).toEqual(["Kept", "Also kept"]);
  });

  it("skips text with no letters, which would come back unchanged", () => {
    expect(collect("<p>1,234.56</p><p>Kept</p>")).toEqual(["Kept"]);
  });

  it("skips SVG text, where HTML text semantics do not apply", () => {
    expect(collect("<svg><text>SvgLabel</text></svg><p>Kept</p>")).toEqual(["Kept"]);
  });

  it("keeps HTML embedded in an SVG foreignObject", () => {
    const collected = collect("<svg><foreignObject><p>HtmlInSvg</p></foreignObject></svg>");
    expect(collected).toEqual(["HtmlInSvg"]);
  });
});

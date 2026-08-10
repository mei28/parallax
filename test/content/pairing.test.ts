// @vitest-environment jsdom
// Pairing tests.
//
// Both panes load the same URL, so their DOM trees should be identical before anything is
// translated. Walking them in lockstep both proves that and hands out the ids the scroll
// sync aligns on. Where the assumption fails — an ad slot, an A/B test, a rotating quote —
// it has to fail loudly, because a silently mispaired index would drag the wrong block into
// view on every scroll.
import { describe, expect, it } from "vitest";
import { pairDocuments } from "../../src/content/pairing.ts";
import { ATTR_PAIR_ID } from "../../src/shared/constants.ts";
import { ParallaxError } from "../../src/shared/errors.ts";

function pair(sourceHtml: string, targetHtml: string = sourceHtml) {
  const source = document.createElement("div");
  const target = document.createElement("div");
  source.innerHTML = sourceHtml;
  target.innerHTML = targetHtml;
  return { source, target, index: pairDocuments(source, target) };
}

describe("pairDocuments", () => {
  it("gives corresponding blocks the same id in both panes", () => {
    const { index } = pair("<h1>Title</h1><p>Body</p>");

    expect(index.ids).toHaveLength(2);
    for (const id of index.ids) {
      expect(index.source.get(id)?.tagName).toBe(index.target.get(id)?.tagName);
    }
  });

  it("indexes the same id set in both panes", () => {
    const { index } = pair("<h1>Title</h1><p>Body</p><ul><li>One</li></ul>");

    expect([...index.source.keys()].sort()).toEqual([...index.target.keys()].sort());
  });

  it("writes the id onto the elements themselves", () => {
    const { target } = pair("<p>Body</p>");

    expect(target.querySelector("p")?.getAttribute(ATTR_PAIR_ID)).toBe("0");
  });

  it("tags block-level anchors, not every element", () => {
    const { target } = pair("<p>Hello <b>bold</b> world</p>");

    expect(target.querySelectorAll(`[${ATTR_PAIR_ID}]`)).toHaveLength(1);
    expect(target.querySelector("b")?.hasAttribute(ATTR_PAIR_ID)).toBe(false);
  });

  it("tags only the outermost candidate, so anchors never nest", () => {
    const { target } = pair("<li><p>Nested</p></li>");

    expect(target.querySelectorAll(`[${ATTR_PAIR_ID}]`)).toHaveLength(1);
    expect(target.querySelector("li")?.hasAttribute(ATTR_PAIR_ID)).toBe(true);
  });

  it("ignores candidates with no text to anchor on", () => {
    const { target } = pair("<p></p><p>Real</p>");

    expect(target.querySelectorAll(`[${ATTR_PAIR_ID}]`)).toHaveLength(1);
  });

  // Two loads of one URL are never quite identical on a real site. Demanding element-for-
  // element equality gave up over a single stray <div>; matching on what the blocks say
  // keeps the ninety-nine that do correspond.
  it("keeps going when one pane has content the other does not", () => {
    const { index, target } = pair("<p>A</p><p>B</p>", "<aside>Ad</aside><p>A</p><p>B</p>");

    expect(index.ids).toHaveLength(2);
    expect(target.querySelector("aside")?.hasAttribute(ATTR_PAIR_ID)).toBe(false);
  });

  it("keeps going when a block is missing from one pane", () => {
    const { index } = pair("<p>A</p><p>B</p><p>C</p>", "<p>A</p><p>C</p>");

    expect(index.ids).toHaveLength(2);
  });

  it("leaves out a block whose text differs between the panes", () => {
    // A relative timestamp reads differently on each load, so it identifies nothing.
    const { index } = pair(
      "<p>Stable</p><p>2 minutes ago</p>",
      "<p>Stable</p><p>3 minutes ago</p>",
    );

    expect(index.ids).toHaveLength(1);
  });

  it("still refuses when the panes have nothing in common to anchor on", () => {
    expect(() => pair("<p>A</p>", "<p>Z</p>")).toThrow(ParallaxError);
    expect(() => pair("<p>A</p>", "<p>Z</p>")).toThrow(/NO_ANCHORS/);
  });

  it("rejects a page with nothing to anchor on", () => {
    expect(() => pair("<div><b>no blocks here</b></div>")).toThrow(/NO_ANCHORS/);
  });
});

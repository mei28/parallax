// @vitest-environment jsdom
// Translation unit tests.
//
// Sarashina rewrites a paragraph as a whole, so a paragraph is its unit: one string sent,
// one translation written back into one of the paragraph's text nodes.
import { describe, expect, it } from "vitest";
import { collectTextNodes } from "../../src/content/text-nodes.ts";
import { blockUnits } from "../../src/content/units.ts";

/** A block built from markup, holding the text nodes the extension would collect from it. */
function block(html: string, anchorId = 0) {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const element = holder.firstElementChild as Element;
  return { element, nodes: collectTextNodes(element), anchorId };
}

const always = () => true;

describe("blockUnits", () => {
  it("makes one unit of a paragraph, reading its nodes as one line", () => {
    const paragraph = block("<p>Read the <a>docs</a>\n  for details.</p>", 3);

    const [unit, ...rest] = blockUnits([paragraph], always);

    expect(rest).toEqual([]);
    expect(unit?.text).toBe("Read the docs for details.");
    expect(unit?.nodes).toEqual(paragraph.nodes);
    expect(unit?.anchorId).toBe(3);
  });

  // The node that receives the translation decides how all of it looks. Inside a link, the
  // whole paragraph would read as one long link.
  it("writes into the first node that sits directly in the block", () => {
    const [unit] = blockUnits([block("<p><a>parallax</a> reads two panes at once.</p>")], always);

    expect(unit?.primary).toBe(1);
  });

  // A navigation item is often nothing but a link. There is no better node than that one.
  it("writes into the first node when none sits directly in the block", () => {
    const [unit] = blockUnits([block("<li><a>Getting <em>started</em></a></li>")], always);

    expect(unit?.primary).toBe(0);
  });

  // paulgraham.com sets a whole essay in one block of <br>-separated lines, well over what
  // one request carries.
  it("cuts a block too long for one request between its nodes, under the same anchor", () => {
    const essay = block(
      "<p>One two three. <b>Four five six.</b> Seven eight nine. <i>Ten.</i></p>",
      7,
    );
    const shortEnough = (text: string) => text.length <= 32;

    const units = blockUnits([essay], shortEnough);

    expect(units.map((unit) => unit.text)).toEqual([
      "One two three. Four five six.",
      "Seven eight nine. Ten.",
    ]);
    expect(units.map((unit) => unit.anchorId)).toEqual([7, 7]);
    expect(units.flatMap((unit) => unit.nodes)).toEqual(essay.nodes);
  });
});

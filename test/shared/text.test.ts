// Text policy tests — which strings are worth sending to the translator.
import { describe, expect, it } from "vitest";
import {
  hasTranslatableContent,
  isSkippedTag,
  joinNodeTexts,
  reassemble,
  segmentWhitespace,
} from "../../src/shared/text.ts";

describe("hasTranslatableContent", () => {
  it("accepts ordinary prose", () => {
    expect(hasTranslatableContent("Hello")).toBe(true);
  });

  it("rejects whitespace-only text", () => {
    expect(hasTranslatableContent("   \n\t ")).toBe(false);
  });

  it("rejects text with no letters", () => {
    expect(hasTranslatableContent("1,234.56")).toBe(false);
  });

  it("rejects punctuation and symbols", () => {
    expect(hasTranslatableContent("→ © — ★")).toBe(false);
  });

  it("accepts non-Latin scripts", () => {
    expect(hasTranslatableContent("日本語")).toBe(true);
  });
});

// Translators trim their input. Feeding them a node's raw data would collapse the single
// space in `<span>Hello</span> <span>world</span>` and the indentation in `<p>\n  Text\n</p>`,
// so the surrounding whitespace is split off before translating and restored afterwards.
describe("segmentWhitespace", () => {
  it("splits leading and trailing whitespace off the core", () => {
    expect(segmentWhitespace("  Hello  ")).toEqual({
      leading: "  ",
      core: "Hello",
      trailing: "  ",
    });
  });

  it("reports empty affixes when there is no surrounding whitespace", () => {
    expect(segmentWhitespace("Hello")).toEqual({ leading: "", core: "Hello", trailing: "" });
  });

  it("preserves newlines and tabs verbatim", () => {
    expect(segmentWhitespace("\n\tHi\n")).toEqual({
      leading: "\n\t",
      core: "Hi",
      trailing: "\n",
    });
  });

  it("treats an all-whitespace string as leading whitespace with an empty core", () => {
    expect(segmentWhitespace("   ")).toEqual({ leading: "   ", core: "", trailing: "" });
  });
});

describe("reassemble", () => {
  it("restores the original whitespace around the translated core", () => {
    expect(reassemble(segmentWhitespace("\n  Hi\n"), "やあ")).toBe("\n  やあ\n");
  });

  it("round-trips when the core is unchanged", () => {
    const original = "  Hello world  ";
    const segmented = segmentWhitespace(original);
    expect(reassemble(segmented, segmented.core)).toBe(original);
  });
});

describe("isSkippedTag", () => {
  it("skips non-prose elements", () => {
    expect(isSkippedTag("SCRIPT")).toBe(true);
    expect(isSkippedTag("STYLE")).toBe(true);
    expect(isSkippedTag("TEXTAREA")).toBe(true);
  });

  it("skips code-bearing elements, whose text is not prose", () => {
    expect(isSkippedTag("CODE")).toBe(true);
    expect(isSkippedTag("PRE")).toBe(true);
    expect(isSkippedTag("KBD")).toBe(true);
  });

  it("keeps ordinary prose elements", () => {
    expect(isSkippedTag("P")).toBe(false);
    expect(isSkippedTag("H1")).toBe(false);
    expect(isSkippedTag("SPAN")).toBe(false);
  });

  it("matches regardless of case", () => {
    expect(isSkippedTag("code")).toBe(true);
    expect(isSkippedTag("Script")).toBe(true);
  });
});

describe("joinNodeTexts", () => {
  it("reads a paragraph's nodes as one line of text", () => {
    expect(joinNodeTexts(["Read the ", "docs", "\n    for details."])).toBe(
      "Read the docs for details.",
    );
  });

  // `<a>Foo</a> <a>Bar</a>`: the space between the links is a node of its own, holding no
  // letters, so it is never collected. Without a space put back the words would run together.
  it("keeps words in neighbouring elements apart", () => {
    expect(joinNodeTexts(["Foo", "Bar"])).toBe("Foo Bar");
  });
});

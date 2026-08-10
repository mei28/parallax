// Aligning two lists of blocks that came from the same page but did not render identically.
//
// Requiring the two panes to match element for element was never going to survive a real
// site: an ad slot, a rotating quote, a relative timestamp, or a nonce is enough to break it,
// and refusing to sync at all over one stray <div> throws away the ninety-nine blocks that do
// correspond. Alignment matches what can be matched and says nothing about the rest.
import { describe, expect, it } from "vitest";
import { alignByUniqueKeys } from "../../src/shared/align.ts";

const pairs = (left: string[], right: string[]) =>
  alignByUniqueKeys(left, right).map(({ left: l, right: r }) => [l, r]);

describe("alignByUniqueKeys", () => {
  it("matches identical lists position for position", () => {
    expect(pairs(["a", "b", "c"], ["a", "b", "c"])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });

  it("skips over something present in only one list", () => {
    expect(pairs(["a", "b", "c"], ["a", "ad", "b", "c"])).toEqual([
      [0, 0],
      [1, 2],
      [2, 3],
    ]);
  });

  it("skips over something missing from one list", () => {
    expect(pairs(["a", "b", "c"], ["a", "c"])).toEqual([
      [0, 0],
      [2, 1],
    ]);
  });

  it("ignores a block whose text differs between the panes", () => {
    // A relative timestamp: same element, different words on each load.
    expect(pairs(["a", "2 minutes ago", "c"], ["a", "3 minutes ago", "c"])).toEqual([
      [0, 0],
      [2, 2],
    ]);
  });

  it("ignores repeated keys, which cannot be told apart", () => {
    expect(pairs(["a", "x", "x", "b"], ["a", "x", "x", "b"])).toEqual([
      [0, 0],
      [3, 3],
    ]);
  });

  it("keeps the matches in order, dropping any that would cross", () => {
    // Reordered content cannot all be honoured: taking both pairs would mean scrolling
    // backwards to go forwards.
    const aligned = pairs(["a", "b", "c"], ["c", "b", "a"]);

    expect(aligned).toHaveLength(1);
  });

  it("finds the longest run when several orderings are possible", () => {
    expect(pairs(["a", "b", "c", "d"], ["d", "a", "b", "c"])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
  });

  it("returns nothing when the two share no unique key", () => {
    expect(pairs(["a", "b"], ["c", "d"])).toEqual([]);
  });

  it("copes with an empty list on either side", () => {
    expect(pairs([], ["a"])).toEqual([]);
    expect(pairs(["a"], [])).toEqual([]);
  });
});

// Anchor math tests — how a reading position in one pane becomes a scroll offset in the other.
import { describe, expect, it } from "vitest";
import type { AnchorSample } from "../../src/shared/scroll.ts";
import { pickAnchor, projectScrollTop } from "../../src/shared/scroll.ts";

// The first entry is the synthetic root anchor that every sample list starts with. It is
// what makes pickAnchor total: the space above the first real block is itself an anchor,
// present in both panes, so there is no "nothing found" case to fall back from.
const SAMPLES: readonly AnchorSample[] = [
  { id: -1, top: 0, height: 100 },
  { id: 7, top: 100, height: 200 },
  { id: 9, top: 300, height: 50 },
];

describe("pickAnchor", () => {
  it("reports how far into a block the reading line has travelled", () => {
    expect(pickAnchor(SAMPLES, 150)).toEqual({ id: 7, fraction: 0.25 });
  });

  it("returns the synthetic root anchor at the top of the document", () => {
    expect(pickAnchor(SAMPLES, 0)).toEqual({ id: -1, fraction: 0 });
  });

  it("lands on the block whose top the reading line sits exactly on", () => {
    expect(pickAnchor(SAMPLES, 100)).toEqual({ id: 7, fraction: 0 });
  });

  it("saturates on the last block below the final anchor", () => {
    expect(pickAnchor(SAMPLES, 10_000)).toEqual({ id: 9, fraction: 1 });
  });

  it("reports the start of a zero-height block rather than dividing by zero", () => {
    const samples: readonly AnchorSample[] = [
      { id: -1, top: 0, height: 0 },
      { id: 3, top: 0, height: 0 },
    ];
    expect(pickAnchor(samples, 0)).toEqual({ id: 3, fraction: 0 });
  });

  it("throws on an empty sample list, which means pairing never ran", () => {
    expect(() => pickAnchor([], 0)).toThrow();
  });
});

describe("projectScrollTop", () => {
  it("maps the fraction onto the follower's own height", () => {
    const follower: AnchorSample = { id: 7, top: 400, height: 300 };
    expect(projectScrollTop({ id: 7, fraction: 0.25 }, follower, 100, 5000)).toBe(375);
  });

  it("clamps above the top of the document", () => {
    const follower: AnchorSample = { id: 7, top: 10, height: 20 };
    expect(projectScrollTop({ id: 7, fraction: 0 }, follower, 100, 5000)).toBe(0);
  });

  it("clamps at the bottom of the document", () => {
    const follower: AnchorSample = { id: 9, top: 4900, height: 300 };
    expect(projectScrollTop({ id: 9, fraction: 1 }, follower, 0, 5000)).toBe(5000);
  });
});

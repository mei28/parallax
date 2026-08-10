// Split geometry tests — every number the resizer and the collapse rule depend on.
import { describe, expect, it } from "vitest";
import type { SplitGeometry } from "../../src/shared/geometry.ts";
import {
  canSplit,
  clampRatio,
  evaluateRatio,
  paneSizes,
  positionToRatio,
} from "../../src/shared/geometry.ts";

// A 1008px container with an 8px handle leaves exactly 1000px for the two panes, which
// keeps the arithmetic in these tests readable.
const G: SplitGeometry = { containerSize: 1008, handleSize: 8, collapseThreshold: 120 };

describe("positionToRatio", () => {
  it("maps the container's midpoint to an even split", () => {
    expect(positionToRatio(504, G)).toBe(0.5);
  });

  it("maps a quarter position to a quarter ratio", () => {
    expect(positionToRatio(254, G)).toBe(0.25);
  });

  it("clamps a pointer dragged past the leading edge", () => {
    expect(positionToRatio(-50, G)).toBe(0);
  });

  it("clamps a pointer dragged past the trailing edge", () => {
    expect(positionToRatio(5000, G)).toBe(1);
  });
});

describe("paneSizes", () => {
  it("splits the available space evenly at ratio 0.5", () => {
    expect(paneSizes(0.5, G)).toEqual({ source: 500, target: 500 });
  });

  it("gives the source pane its share and the target the rest", () => {
    expect(paneSizes(0.25, G)).toEqual({ source: 250, target: 750 });
  });

  it("excludes the handle from both panes", () => {
    const { source, target } = paneSizes(0.5, G);
    expect(source + target + G.handleSize).toBe(G.containerSize);
  });
});

describe("evaluateRatio", () => {
  it("reports a plain split when both panes clear the threshold", () => {
    expect(evaluateRatio(0.5, G)).toEqual({ kind: "split", ratio: 0.5 });
  });

  it("collapses the source pane when it falls under the threshold", () => {
    expect(evaluateRatio(0.05, G)).toEqual({ kind: "collapse", collapsed: "source" });
  });

  it("collapses the target pane when it falls under the threshold", () => {
    expect(evaluateRatio(0.98, G)).toEqual({ kind: "collapse", collapsed: "target" });
  });

  it("treats a pane sitting exactly on the threshold as still open", () => {
    // 0.12 of 1000px is exactly the 120px threshold.
    expect(evaluateRatio(0.12, G)).toEqual({ kind: "split", ratio: 0.12 });
  });
});

describe("canSplit", () => {
  it("rejects a container too narrow for two panes and the handle", () => {
    expect(canSplit({ containerSize: 240, handleSize: 8, collapseThreshold: 120 })).toBe(false);
  });

  it("accepts a container that fits both thresholds and the handle exactly", () => {
    expect(canSplit({ containerSize: 248, handleSize: 8, collapseThreshold: 120 })).toBe(true);
  });
});

describe("clampRatio", () => {
  it("pulls a too-small ratio up to the threshold", () => {
    expect(clampRatio(0.02, G)).toBe(0.12);
  });

  it("pulls a too-large ratio down to the threshold", () => {
    expect(clampRatio(0.99, G)).toBe(0.88);
  });

  it("leaves a ratio between the thresholds alone", () => {
    expect(clampRatio(0.4, G)).toBe(0.4);
  });
});

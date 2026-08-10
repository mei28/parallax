// @vitest-environment jsdom
// Scroll synchronisation wiring.
//
// The arithmetic is in shared/scroll.ts and the echo guard in shared/sync-state.ts, both
// already covered. What is tested here is what only the DOM can get wrong: sampling the
// panes, driving the follower, and not driving it back.
import { beforeEach, describe, expect, it } from "vitest";
import { pairDocuments } from "../../src/content/pairing.ts";
import { collectSamples, createScrollSync } from "../../src/content/scroll-sync.ts";
import { ATTR_PAIR_ID, ROOT_ANCHOR_ID } from "../../src/shared/constants.ts";

/**
 * jsdom lays nothing out, so every element reports a zero-sized box. Heights are assigned
 * here instead, which is also the only way to model the thing that makes this hard: the same
 * block occupying a different height once translated.
 */
function layout(doc: Document, heights: readonly number[]): void {
  let top = 0;
  const blocks = [...doc.querySelectorAll(`[${ATTR_PAIR_ID}]`)];
  blocks.forEach((block, index) => {
    const height = heights[index] ?? 100;
    const at = top;
    block.getBoundingClientRect = () =>
      ({ top: at - (doc.scrollingElement?.scrollTop ?? 0), height }) as DOMRect;
    top += height;
  });
  Object.defineProperty(doc.documentElement, "scrollHeight", { value: top, configurable: true });
}

function pane(html: string, heights: readonly number[]) {
  const doc = document.implementation.createHTMLDocument("pane");
  doc.body.innerHTML = html;
  // Smaller than the content, or there is nothing to scroll and every projection clamps to 0.
  Object.defineProperty(doc.documentElement, "clientHeight", { value: 200, configurable: true });
  return { doc, heights };
}

const ARTICLE = "<h1>One</h1><p>Two</p><p>Three</p>";

function setUp(sourceHeights: number[], targetHeights: number[]) {
  const source = pane(ARTICLE, sourceHeights);
  const target = pane(ARTICLE, targetHeights);
  const index = pairDocuments(source.doc.body, target.doc.body);
  layout(source.doc, sourceHeights);
  layout(target.doc, targetHeights);
  return { source: source.doc, target: target.doc, index };
}

let scrollTops: { source: number; target: number };

function scrollTo(doc: Document, value: number, which: "source" | "target") {
  scrollTops[which] = value;
  Object.defineProperty(doc.documentElement, "scrollTop", {
    value,
    writable: true,
    configurable: true,
  });
  doc.dispatchEvent(new Event("scroll"));
}

beforeEach(() => {
  scrollTops = { source: 0, target: 0 };
});

describe("collectSamples", () => {
  it("starts with the synthetic root anchor, covering the space above the first block", () => {
    const { source, index } = setUp([100, 200, 50], [100, 200, 50]);

    const samples = collectSamples(source, index.source);

    expect(samples[0]?.id).toBe(ROOT_ANCHOR_ID);
    expect(samples[0]?.top).toBe(0);
  });

  it("returns one sample per paired block, in document order", () => {
    const { source, index } = setUp([100, 200, 50], [100, 200, 50]);

    const samples = collectSamples(source, index.source);

    expect(samples).toHaveLength(index.ids.length + 1);
    expect(samples.map((sample) => sample.top)).toEqual([0, 0, 100, 300]);
  });

  it("reports each pane's own heights, which is the point of sampling both", () => {
    const { target, index } = setUp([100, 200, 50], [100, 340, 50]);

    const samples = collectSamples(target, index.target);

    expect(samples.map((sample) => sample.height)).toEqual([0, 100, 340, 50]);
  });
});

describe("createScrollSync", () => {
  function start(sourceHeights: number[], targetHeights: number[]) {
    const panes = setUp(sourceHeights, targetHeights);
    const abort = new AbortController();
    const applied: { pane: string; scrollTop: number }[] = [];
    createScrollSync({
      documents: { source: panes.source, target: panes.target },
      index: panes.index,
      apply: (id, scrollTop) => {
        // Browsers round; modelling that is the point of the test below.
        const landed = Math.round(scrollTop);
        applied.push({ pane: id, scrollTop: landed });
        scrollTops[id] = landed;
        return landed;
      },
      signal: abort.signal,
    });
    return { ...panes, applied, abort };
  }

  it("brings the matching block to the same place in the other pane", () => {
    // Translated middle block is taller: 100 / 340 / 50 against 100 / 200 / 50.
    const { source, applied } = start([100, 200, 50], [100, 340, 50]);

    // Reading line 100px into the second block, which spans 100..300.
    scrollTo(source, 200 - 0.2 * 200, "source");

    expect(applied).toHaveLength(1);
    // Half way through a 200px block maps to half way through the 340px one.
    expect(applied[0]?.scrollTop).toBeCloseTo(100 + 0.5 * 340 - 0.2 * 200, 0);
  });

  it("does not answer its own write, so the panes cannot drive each other", () => {
    const { source, target, applied } = start([100, 200, 50], [100, 200, 50]);

    scrollTo(source, 300, "source");
    const written = applied[0]?.scrollTop ?? 0;
    scrollTo(target, written, "target");

    expect(applied).toHaveLength(1);
  });

  it("recognises its own write even though the browser rounded it", () => {
    // The projection lands on a fraction; the browser stores an integer. Recording the
    // request rather than the result would make the echo look like the reader scrolling,
    // and the panes would drive each other from then on.
    const { source, target, applied } = start([100, 200, 50], [100, 341, 50]);

    scrollTo(source, 160, "source");
    scrollTo(target, applied[0]?.scrollTop ?? 0, "target");

    expect(applied).toHaveLength(1);
  });

  it("follows the reader when they take over the other pane", () => {
    const { source, target, applied } = start([100, 200, 50], [100, 200, 50]);

    scrollTo(source, 300, "source");
    scrollTo(target, (applied[0]?.scrollTop ?? 0) + 40, "target");

    expect(applied).toHaveLength(2);
    expect(applied[1]?.pane).toBe("source");
  });

  it("stops when the split is torn down", () => {
    const { source, applied, abort } = start([100, 200, 50], [100, 200, 50]);

    abort.abort();
    scrollTo(source, 300, "source");

    expect(applied).toEqual([]);
  });

  it("recomputes its samples when a pane's blocks change height", () => {
    const panes = setUp([100, 200, 50], [100, 200, 50]);
    const abort = new AbortController();
    const applied: number[] = [];
    const sync = createScrollSync({
      documents: { source: panes.source, target: panes.target },
      index: panes.index,
      apply: (_id, scrollTop) => {
        applied.push(scrollTop);
        return scrollTop;
      },
      signal: abort.signal,
    });

    // Translation lands and the middle block grows.
    layout(panes.target, [100, 340, 50]);
    sync.invalidate();
    scrollTo(panes.source, 200 - 0.2 * 200, "source");

    expect(applied[0]).toBeCloseTo(100 + 0.5 * 340 - 0.2 * 200, 0);
  });
});

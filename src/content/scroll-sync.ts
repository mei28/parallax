// Keeping the two panes on the same sentence.
//
// The arithmetic lives in shared/scroll.ts and the echo guard in shared/sync-state.ts. This
// module does the part only the DOM can do: measure where each paired block sits, and write
// the follower's scroll offset.
import { ANCHOR_LINE_FRACTION, ROOT_ANCHOR_ID, SAMPLE_DEBOUNCE_MS } from "../shared/constants.ts";
import type { AnchorSample } from "../shared/scroll.ts";
import { pickAnchor, projectScrollTop } from "../shared/scroll.ts";
import { createSyncState, expectScroll, observeScroll } from "../shared/sync-state.ts";
import type { PaneId } from "../shared/types.ts";
import type { PairIndex } from "./pairing.ts";

export interface ScrollSyncOptions {
  documents: Readonly<Record<PaneId, Document>>;
  index: PairIndex;
  /** Injected so tests can observe the writes without a layout engine. */
  /**
   * Injected so tests can observe the writes without a layout engine.
   *
   * Returns where the scroll actually landed, which is not always what was asked for.
   */
  apply?: (pane: PaneId, scrollTop: number) => number;
  signal: AbortSignal;
}

export interface ScrollSync {
  /** Re-measure, after translation has changed how tall the blocks are. */
  invalidate(): void;
}

function scrollTopOf(doc: Document): number {
  return doc.scrollingElement?.scrollTop ?? doc.documentElement.scrollTop;
}

function maxScrollTopOf(doc: Document): number {
  return Math.max(0, doc.documentElement.scrollHeight - doc.documentElement.clientHeight);
}

/**
 * Measure where each paired block sits in one pane.
 *
 * The list always opens with a synthetic anchor covering everything above the first block.
 * That is what makes pickAnchor total: the top of the document is an anchor like any other,
 * present in both panes under the same id, so there is no "nothing matched" case to invent
 * behaviour for.
 */
export function collectSamples(
  doc: Document,
  blocks: ReadonlyMap<number, Element>,
): AnchorSample[] {
  const scrollTop = scrollTopOf(doc);
  const samples: AnchorSample[] = [];
  for (const [id, element] of blocks) {
    if (!element.isConnected) {
      continue;
    }
    const box = element.getBoundingClientRect();
    samples.push({ id, top: box.top + scrollTop, height: box.height });
  }
  samples.sort((left, right) => left.top - right.top);

  const first = samples[0];
  samples.unshift({ id: ROOT_ANCHOR_ID, top: 0, height: first === undefined ? 0 : first.top });
  return samples;
}

function findById(samples: readonly AnchorSample[], id: number): AnchorSample | undefined {
  return samples.find((sample) => sample.id === id);
}

export function createScrollSync(options: ScrollSyncOptions): ScrollSync {
  const { documents, index, signal } = options;
  const other = (pane: PaneId): PaneId => (pane === "source" ? "target" : "source");

  let samples: Record<PaneId, AnchorSample[]> = {
    source: collectSamples(documents.source, index.source),
    target: collectSamples(documents.target, index.target),
  };
  let state = createSyncState();

  const write = (pane: PaneId, scrollTop: number): void => {
    let landed: number;
    if (options.apply !== undefined) {
      landed = options.apply(pane, scrollTop);
    } else {
      const element = documents[pane].scrollingElement ?? documents[pane].documentElement;
      // Assigned rather than scrollTo({behavior:"smooth"}): a smooth scroll arrives as a
      // stream of intermediate offsets, none of which match what was asked for.
      element.scrollTop = scrollTop;
      landed = element.scrollTop;
    }
    // What the browser took, not what it was asked for. It rounds and clamps, so recording
    // the request would leave the echo looking like a different value — the reader scrolling
    // — and the two panes would start driving each other.
    state = expectScroll(state, pane, landed);
  };

  const onScroll = (pane: PaneId): void => {
    const observed = observeScroll(state, pane, scrollTopOf(documents[pane]));
    state = observed.state;
    if (observed.kind === "echo") {
      return;
    }

    const leader = documents[pane];
    const follower = other(pane);
    const offset = ANCHOR_LINE_FRACTION * leader.documentElement.clientHeight;
    const pick = pickAnchor(samples[pane], scrollTopOf(leader) + offset);
    const match = findById(samples[follower], pick.id);
    if (match === undefined) {
      // Every id in one pane exists in the other by construction, so this is a programming
      // error rather than a state to recover from.
      throw new Error(`pane ${follower} has no block with id ${pick.id}`);
    }

    write(
      follower,
      projectScrollTop(
        pick,
        match,
        ANCHOR_LINE_FRACTION * documents[follower].documentElement.clientHeight,
        maxScrollTopOf(documents[follower]),
      ),
    );
  };

  for (const pane of ["source", "target"] as const) {
    documents[pane].addEventListener("scroll", () => onScroll(pane), { signal, passive: true });
  }

  let pending: ReturnType<typeof setTimeout> | undefined;
  const invalidate = (): void => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      samples = {
        source: collectSamples(documents.source, index.source),
        target: collectSamples(documents.target, index.target),
      };
    }, SAMPLE_DEBOUNCE_MS);
  };

  // Lazily translated blocks change height as they arrive, which moves every anchor below
  // them. Re-measuring on resize catches that without polling.
  for (const pane of ["source", "target"] as const) {
    const view = documents[pane].defaultView;
    if (view?.ResizeObserver !== undefined) {
      const observer = new view.ResizeObserver(invalidate);
      observer.observe(documents[pane].documentElement);
      signal.addEventListener("abort", () => observer.disconnect(), { once: true });
    }
  }
  signal.addEventListener("abort", () => clearTimeout(pending), { once: true });

  return {
    invalidate(): void {
      samples = {
        source: collectSamples(documents.source, index.source),
        target: collectSamples(documents.target, index.target),
      };
    },
  };
}

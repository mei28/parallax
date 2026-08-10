// Anchor math — turning a reading position in one pane into a scroll offset in the other.
//
// Proportional syncing (scrollTop over scrollHeight) drifts, because a translated paragraph
// rarely occupies the same height as its original. Instead the panes agree on a set of
// corresponding blocks, and the follower is scrolled so the block the reader is looking at
// lands at the same place on screen.
import { clamp } from "./num.ts";

export interface AnchorSample {
  readonly id: number;
  /** Distance from the top of the document to the top of the block. */
  readonly top: number;
  readonly height: number;
}

export interface AnchorPick {
  readonly id: number;
  /** How far through the block the reading line has travelled, 0..1. */
  readonly fraction: number;
}

function sampleAt(samples: readonly AnchorSample[], index: number): AnchorSample {
  const sample = samples[index];
  if (sample === undefined) {
    throw new Error(`anchor sample ${index} is out of range`);
  }
  return sample;
}

/**
 * Find the block the reading line falls in, and how far into it.
 *
 * Every sample list begins with a synthetic root anchor covering the space above the first
 * real block, which is what lets this be a total function: there is no "no anchor here"
 * case, and therefore no fallback path for the caller to take.
 *
 * @throws if the list is empty, which means document pairing never ran.
 */
export function pickAnchor(samples: readonly AnchorSample[], readingLine: number): AnchorPick {
  if (samples.length === 0) {
    throw new Error("pickAnchor: empty sample list; the panes have not been paired");
  }

  // Binary search for the last block starting at or above the reading line.
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (sampleAt(samples, mid).top <= readingLine) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  const anchor = sampleAt(samples, low);
  const fraction = anchor.height > 0 ? clamp((readingLine - anchor.top) / anchor.height, 0, 1) : 0;
  return { id: anchor.id, fraction };
}

/**
 * Scroll offset that puts the follower's matching block at the same place on screen.
 *
 * @param offset how far down the follower's viewport the reading line sits.
 */
export function projectScrollTop(
  pick: AnchorPick,
  follower: AnchorSample,
  offset: number,
  maxScrollTop: number,
): number {
  return clamp(follower.top + pick.fraction * follower.height - offset, 0, maxScrollTop);
}

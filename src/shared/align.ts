// Aligning two lists of blocks that came from the same page but did not render identically.
//
// The panes are two loads of one URL, so most of their content corresponds — but not all of
// it. Ad slots, rotating quotes, relative timestamps and per-response tokens all differ, and
// a correspondence that demands element-for-element equality gives up over any one of them.
//
// This is the anchoring step of a patience diff. Only keys appearing exactly once on each
// side are considered, because a key appearing twice gives no way to tell which occurrence
// is which; among those, the longest run that preserves order is kept, since a pair that
// crosses another would mean scrolling backwards to go forwards.
//
// Cheaper than a full longest-common-subsequence, and the result is evidence rather than
// assumption: a match means the two blocks genuinely say the same thing.

export interface AlignedPair {
  readonly left: number;
  readonly right: number;
}

function indexOfUniqueKeys(keys: readonly string[]): Map<string, number> {
  const seen = new Map<string, number>();
  const duplicated = new Set<string>();
  keys.forEach((key, index) => {
    if (seen.has(key)) {
      duplicated.add(key);
      return;
    }
    seen.set(key, index);
  });
  for (const key of duplicated) {
    seen.delete(key);
  }
  return seen;
}

/**
 * Longest strictly increasing subsequence, by right-hand index.
 *
 * Patience sort: `tails[k]` holds the smallest right index that can end an increasing run of
 * length k + 1, and `previous` threads each candidate back to its predecessor so the winning
 * run can be reconstructed.
 */
function longestIncreasingRun(candidates: readonly AlignedPair[]): AlignedPair[] {
  if (candidates.length === 0) {
    return [];
  }
  const tails: number[] = [];
  const previous = new Array<number>(candidates.length).fill(-1);

  candidates.forEach((candidate, index) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      const at = tails[mid];
      const rightAtMid = at === undefined ? Number.NEGATIVE_INFINITY : candidates[at]?.right;
      if (rightAtMid !== undefined && rightAtMid < candidate.right) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    if (low > 0) {
      previous[index] = tails[low - 1] ?? -1;
    }
    tails[low] = index;
  });

  const run: AlignedPair[] = [];
  let cursor = tails[tails.length - 1] ?? -1;
  while (cursor >= 0) {
    const pair = candidates[cursor];
    if (pair === undefined) {
      break;
    }
    run.push(pair);
    cursor = previous[cursor] ?? -1;
  }
  return run.reverse();
}

/**
 * Pair up positions in two lists by the keys they hold.
 *
 * @returns matched positions, in ascending order on both sides. Positions with no
 * counterpart are simply absent — they are the parts of the page that did not come out the
 * same twice, and there is nothing to anchor them to.
 */
export function alignByUniqueKeys(
  left: readonly string[],
  right: readonly string[],
): AlignedPair[] {
  const rightIndex = indexOfUniqueKeys(right);
  const leftIndex = indexOfUniqueKeys(left);

  const candidates: AlignedPair[] = [];
  for (const [key, leftAt] of leftIndex) {
    const rightAt = rightIndex.get(key);
    if (rightAt !== undefined) {
      candidates.push({ left: leftAt, right: rightAt });
    }
  }
  candidates.sort((a, b) => a.left - b.left);

  return longestIncreasingRun(candidates);
}

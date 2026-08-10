// Establishing which block in one pane corresponds to which block in the other.
//
// Both panes load the same URL, so before any translation their trees should be identical.
// Walking them in lockstep both checks that and hands out the ids scroll sync aligns on.
//
// This runs once, before the first translate() call. Translation only ever assigns
// Text.data, so the index it produces stays valid for the whole session — including as
// lazily translated content changes the panes' heights.
import { ATTR_PAIR_ID } from "../shared/constants.ts";
import { ParallaxError } from "../shared/errors.ts";

/**
 * Elements worth anchoring on: block-level boxes a reader can recognise.
 *
 * Tagging every element would mean thousands of attribute writes and, worse, thousands of
 * getBoundingClientRect() calls each time the samples are refreshed. Only block-level boxes
 * make useful scroll anchors, so the walk visits everything but tags a filtered subset.
 */
const ANCHOR_TAGS: ReadonlySet<string> = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "DT",
  "DD",
  "TD",
  "TH",
  "BLOCKQUOTE",
  "PRE",
  "FIGURE",
  "FIGCAPTION",
]);

export interface PairIndex {
  readonly ids: readonly number[];
  readonly source: ReadonlyMap<number, Element>;
  readonly target: ReadonlyMap<number, Element>;
}

function isAnchorCandidate(element: Element): boolean {
  if (!ANCHOR_TAGS.has(element.tagName)) {
    return false;
  }
  if (element.textContent === null || element.textContent.trim() === "") {
    return false;
  }
  // Outermost wins, so anchors never nest and a <p> inside an <li> does not double up.
  return element.parentElement?.closest(`[${ATTR_PAIR_ID}]`) == null;
}

/**
 * Pair two structurally identical trees, tagging corresponding blocks with the same id.
 *
 * @throws ParallaxError DOM_MISMATCH if the trees diverge, NO_ANCHORS if neither has a
 * block to align on. Both leave the split working and only disable scroll sync — but they
 * are reported, because a silently mispaired index scrolls the wrong block into view.
 */
export function pairDocuments(sourceRoot: Element, targetRoot: Element): PairIndex {
  const sourceWalker = sourceRoot.ownerDocument.createTreeWalker(
    sourceRoot,
    NodeFilter.SHOW_ELEMENT,
  );
  const targetWalker = targetRoot.ownerDocument.createTreeWalker(
    targetRoot,
    NodeFilter.SHOW_ELEMENT,
  );

  const ids: number[] = [];
  const source = new Map<number, Element>();
  const target = new Map<number, Element>();
  let nextId = 0;

  for (;;) {
    const sourceNode = sourceWalker.nextNode() as Element | null;
    const targetNode = targetWalker.nextNode() as Element | null;

    if (sourceNode === null && targetNode === null) {
      break;
    }
    if (sourceNode === null || targetNode === null || sourceNode.tagName !== targetNode.tagName) {
      throw new ParallaxError({ code: "DOM_MISMATCH" });
    }

    if (isAnchorCandidate(sourceNode) && isAnchorCandidate(targetNode)) {
      const id = nextId++;
      sourceNode.setAttribute(ATTR_PAIR_ID, String(id));
      targetNode.setAttribute(ATTR_PAIR_ID, String(id));
      ids.push(id);
      source.set(id, sourceNode);
      target.set(id, targetNode);
    }
  }

  if (ids.length === 0) {
    throw new ParallaxError({ code: "NO_ANCHORS" });
  }
  return { ids, source, target };
}

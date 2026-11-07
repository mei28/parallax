// What the queue translates as one piece.
import { chunkWhile } from "../shared/chunks.ts";
import { joinNodeTexts, segmentWhitespace } from "../shared/text.ts";
import type { TranslationUnit } from "./translate-queue.ts";

/** A block the reader would recognise, and the text nodes collected from inside it. */
export interface Block {
  readonly element: Element;
  /** In document order. */
  readonly nodes: readonly Text[];
  /** The block's index, which is how the viewport observer and the queue name it. */
  readonly anchorId: number;
}

/** One text node on its own, which is how the on-device translator takes its text. */
export function nodeUnit(node: Text, anchorId: number): TranslationUnit {
  return { text: segmentWhitespace(node.data).core, nodes: [node], primary: 0, anchorId };
}

/** Every node of every block as a unit of its own. */
export function nodeUnits(blocks: readonly Block[]): TranslationUnit[] {
  return blocks.flatMap((block) => block.nodes.map((node) => nodeUnit(node, block.anchorId)));
}

/**
 * Which node a paragraph's translation is written into: the first that sits directly in the
 * block, so a paragraph that opens with a link does not become one long link, or else the
 * first, for a block such as a menu item that is nothing but a link.
 */
function primaryOf(nodes: readonly Text[], element: Element): number {
  const direct = nodes.findIndex((node) => node.parentElement === element);
  return direct === -1 ? 0 : direct;
}

/**
 * Each block as one unit, for a translator that rewrites a paragraph as a whole.
 *
 * @param fits whether a unit's text can be sent at all.
 */
export function blockUnits(
  blocks: readonly Block[],
  fits: (text: string) => boolean,
): TranslationUnit[] {
  const textOf = (nodes: readonly Text[]): string => joinNodeTexts(nodes.map((node) => node.data));
  // A block too long for one request is cut between its nodes, each piece its own unit
  // under the block's anchor. A node is the smallest thing a translation can be written to.
  return blocks.flatMap((block) =>
    chunkWhile(block.nodes, (nodes) => fits(textOf(nodes))).map((nodes) => ({
      text: textOf(nodes),
      nodes,
      primary: primaryOf(nodes, block.element),
      anchorId: block.anchorId,
    })),
  );
}

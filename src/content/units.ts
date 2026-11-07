// What the queue translates as one piece.
import { segmentWhitespace } from "../shared/text.ts";
import type { TranslationUnit } from "./translate-queue.ts";

/** One text node on its own, which is how the on-device translator takes its text. */
export function nodeUnit(node: Text, anchorId: number): TranslationUnit {
  return { text: segmentWhitespace(node.data).core, nodes: [node], primary: 0, anchorId };
}

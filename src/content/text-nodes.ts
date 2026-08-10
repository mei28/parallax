// Collecting the text worth translating out of a pane's document.
import { hasTranslatableContent, isSkippedTag } from "../shared/text.ts";

const HTML_NS = "http://www.w3.org/1999/xhtml";

/**
 * Ancestors that mean "leave this text alone".
 *
 * `translate="no"` and `.notranslate` are the author's own signals, honoured by browser
 * translation for years. `aria-hidden` content is overwhelmingly icon-font ligatures, where
 * translating would replace a glyph with a word. `contenteditable` holds the user's text.
 */
const OPT_OUT_SELECTOR = [
  '[translate="no"]',
  ".notranslate",
  '[aria-hidden="true"]',
  '[contenteditable="true"]',
].join(", ");

function hasSkippedAncestor(element: Element): boolean {
  for (let current: Element | null = element; current !== null; current = current.parentElement) {
    if (isSkippedTag(current.tagName)) {
      return true;
    }
  }
  return false;
}

/**
 * Every text node under `root` that is worth a translate() call, in document order.
 *
 * Note that the namespace test looks only at the immediate parent, not at ancestors. That
 * is what keeps HTML inside an SVG `<foreignObject>` — which is genuinely prose — while
 * still rejecting an SVG `<text>` element, where HTML text semantics do not apply.
 */
export function collectTextNodes(root: Element): Text[] {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      const parent = node.parentElement;
      if (parent === null || parent.namespaceURI !== HTML_NS) {
        return NodeFilter.FILTER_REJECT;
      }
      if (hasSkippedAncestor(parent) || parent.closest(OPT_OUT_SELECTOR) !== null) {
        return NodeFilter.FILTER_REJECT;
      }
      return hasTranslatableContent(node.nodeValue ?? "")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const collected: Text[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    collected.push(node as Text);
  }
  return collected;
}

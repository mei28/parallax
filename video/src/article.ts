import raw from "../../store-assets/article.json";

export type BlockKind = "title" | "heading" | "paragraph";

/** One block of the article: the same element in both panes, in each language. */
export type Block = { kind: BlockKind; en: string; ja: string };

const KINDS: readonly string[] = ["title", "heading", "paragraph"] satisfies BlockKind[];
const isKind = (kind: string): kind is BlockKind => KINDS.includes(kind);

/**
 * The article both panes show: real sentences from the fixture and their translation,
 * shared with the listing images. Checked on load, so a typo in the JSON stops the render
 * instead of drawing a block with no style.
 */
export const ARTICLE: readonly Block[] = raw.map((block, i) => {
  if (!isKind(block.kind)) {
    throw new Error(`store-assets/article.json block ${i}: unknown kind "${block.kind}"`);
  }
  return { kind: block.kind, en: block.en, ja: block.ja };
});

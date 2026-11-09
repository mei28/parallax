// Text policy — which strings are worth a translate() call, and how to keep the whitespace
// around them intact.

/** A text node's data split into the part to translate and the whitespace framing it. */
export interface Segmented {
  readonly leading: string;
  readonly core: string;
  readonly trailing: string;
}

const SKIPPED_TAGS: ReadonlySet<string> = new Set([
  // Elements whose text is markup, data or control state rather than prose.
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "CANVAS",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "AUDIO",
  "VIDEO",
  // Code, where translating identifiers and keywords destroys the meaning.
  "CODE",
  "PRE",
  "KBD",
  "SAMP",
  "VAR",
]);

/**
 * Whether a string is worth sending to the translator.
 *
 * Numbers, punctuation, symbols and icon glyphs make up a large share of a page's text
 * nodes. Each one costs a sequential translate() call and comes back unchanged, so
 * requiring at least one letter is what keeps the queue short.
 */
export function hasTranslatableContent(text: string): boolean {
  return /\p{L}/u.test(text);
}

/** Whether text inside this element should be left alone. Case-insensitive. */
export function isSkippedTag(tagName: string): boolean {
  return SKIPPED_TAGS.has(tagName.toUpperCase());
}

/**
 * Split a text node's data into its translatable core and the whitespace around it.
 *
 * Translators trim their input, so translating a node's raw data would collapse the single
 * space in `<span>Hello</span> <span>world</span>` and the indentation in `<p>\n  Text\n</p>`.
 */
export function segmentWhitespace(text: string): Segmented {
  const core = text.trim();
  if (core === "") {
    // Nothing to translate. Keeping the whole run in `leading` makes reassemble() lossless.
    return { leading: text, core: "", trailing: "" };
  }
  const leadingLength = text.length - text.trimStart().length;
  return {
    leading: text.slice(0, leadingLength),
    core,
    trailing: text.slice(leadingLength + core.length),
  };
}

/** Put a translated core back between the whitespace it came with. */
export function reassemble(segmented: Segmented, translatedCore: string): string {
  return segmented.leading + translatedCore + segmented.trailing;
}

/**
 * Several text nodes read as one line, as a paragraph-at-a-time translator wants them.
 *
 * Joined with a space and then collapsed: the whitespace between two elements is often a
 * node of its own that holds no letters and so was never collected, and without a space put
 * back the words on either side would run together.
 */
export function joinNodeTexts(texts: readonly string[]): string {
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

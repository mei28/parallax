// Orchestration: what happens between the reader asking for a split and getting one.
//
// Ordering matters here. Availability is checked before the overlay exists, so an
// unsupported language pair never costs two page loads. Translation only starts once both
// panes have a readable document, so a blocked site fails as a message rather than as two
// blank rectangles.
import { renderMessage } from "../chrome/i18n.ts";
import { describeFailure, ParallaxError } from "../shared/errors.ts";
import type { LanguagePair, Preferences } from "../shared/types.ts";
import { openPane } from "./frames.ts";
import type { Overlay } from "./overlay.ts";
import { createOverlay } from "./overlay.ts";
import { collectTextNodes } from "./text-nodes.ts";
import type { Queue, TranslateTarget } from "./translate-queue.ts";
import { createQueue } from "./translate-queue.ts";
import type { TranslatorSession } from "./translator.ts";
import { checkAvailability, createTranslator } from "./translator.ts";

/** Two viewports of lead time, so height changes happen well below the reading position. */
const LAZY_ROOT_MARGIN = "200% 0px 200% 0px";

/**
 * Blocks the reader can recognise. Text is grouped by its nearest such ancestor so the
 * viewport observer has something to watch, and so a block arrives translated all at once
 * rather than a word at a time.
 */
const BLOCK_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, li, dt, dd, td, th, blockquote, figure, figcaption, section, article, div";

export interface Controller {
  destroy(): void;
}

function groupByBlock(doc: Document, nodes: readonly Text[]) {
  const blocks: Element[] = [];
  const indexOf = new Map<Element, number>();
  const targets: TranslateTarget[] = [];

  for (const node of nodes) {
    const block = node.parentElement?.closest(BLOCK_SELECTOR) ?? doc.body;
    let index = indexOf.get(block);
    if (index === undefined) {
      index = blocks.length;
      indexOf.set(block, index);
      blocks.push(block);
    }
    targets.push({ node, anchorId: index });
  }
  return { blocks, targets };
}

/**
 * Translate what is on screen first.
 *
 * Measured at roughly 29 ms per call, a 400-node article translated in document order would
 * leave the reader watching an untranslated page for a quarter of a minute. Ordering by what
 * is in view turns that into the length of one screen.
 */
function observeViewport(
  // `Window` alone does not declare the constructors a realm carries; the intersection with
  // typeof globalThis is what makes frameWindow.IntersectionObserver visible to the checker.
  frameWindow: Window & typeof globalThis,
  blocks: readonly Element[],
  queue: Queue,
  signal: AbortSignal,
): void {
  // Constructed in the frame's own realm, so `root: null` means that frame's viewport
  // rather than the embedder's.
  const observer = new frameWindow.IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => blocks.indexOf(entry.target))
        .filter((index) => index >= 0);
      if (visible.length > 0) {
        queue.prioritize(visible);
      }
    },
    { root: null, rootMargin: LAZY_ROOT_MARGIN },
  );
  for (const block of blocks) {
    observer.observe(block);
  }
  signal.addEventListener("abort", () => observer.disconnect(), { once: true });
}

export async function startSplit(doc: Document, preferences: Preferences): Promise<Controller> {
  const pair: LanguagePair = {
    source: preferences.sourceLanguage,
    target: preferences.targetLanguage,
  };

  // Before anything is built, so a refusal costs nothing.
  const availability = await checkAvailability(pair);

  const abort = new AbortController();
  const overlay = createOverlay(doc, { url: doc.location.href });
  overlay.setRatio(preferences.ratio);
  overlay.setOrientation(preferences.orientation);

  let queue: Queue | null = null;
  let translator: TranslatorSession | null = null;

  const controller: Controller = {
    destroy() {
      abort.abort();
      queue?.destroy();
      translator?.destroy();
      overlay.destroy();
    },
  };

  overlay.setStatus("idle", "Loading both panes…");

  let targetDoc: Document;
  try {
    [, targetDoc] = await Promise.all([
      openPane(overlay.frames.source, doc.location.href, abort.signal),
      openPane(overlay.frames.target, doc.location.href, abort.signal),
    ]);
  } catch (error) {
    reportBlocking(overlay, error);
    return controller;
  }

  const run = async (): Promise<void> => {
    try {
      translator = await createTranslator(pair, {
        onDownloadProgress(fraction) {
          overlay.setStatus("downloading", `Downloading the language pack — ${fraction * 100}%`);
          overlay.setProgress(fraction);
        },
      });
    } catch (error) {
      reportBlocking(overlay, error);
      return;
    }

    overlay.hideCard();
    const { blocks, targets } = groupByBlock(targetDoc, collectTextNodes(targetDoc.body));
    if (targets.length === 0) {
      overlay.setStatus("ready", "Nothing on this page needs translating.");
      return;
    }

    const session = translator;
    queue = createQueue({
      translate: (text) => session.translate(text),
      onProgress(done, total) {
        overlay.setStatus("translating", `Translating ${done} of ${total}…`);
        if (done === total) {
          overlay.setStatus("ready", "Translated.");
        }
      },
      onCommit() {},
      onError(failure) {
        overlay.setStatus(
          "error",
          renderMessage(describeFailure({ code: "TRANSLATE_FAILED", detail: failure })),
        );
      },
      signal: abort.signal,
    });

    // openPane() has already proved this frame is same-origin and readable.
    const frameWindow = overlay.frames.target.contentWindow as Window & typeof globalThis;
    observeViewport(frameWindow, blocks, queue, abort.signal);
    queue.enqueue(targets);
  };

  if (availability === "available") {
    void run();
  } else {
    // create() needs transient activation before it will download a pack, and a click on the
    // toolbar icon does not give the page any. This click does.
    overlay.showCard(`Translate this page into ${pair.target}?`, {
      label: "Translate",
      onClick: () => void run(),
    });
  }

  return controller;
}

function reportBlocking(overlay: Overlay, error: unknown): void {
  const failure =
    error instanceof ParallaxError
      ? error.failure
      : ({
          code: "DOWNLOAD_FAILED",
          detail: { reason: error instanceof Error ? error.message : String(error) },
        } as const);
  overlay.showCard(renderMessage(describeFailure(failure)));
  overlay.setStatus("error", "");
}

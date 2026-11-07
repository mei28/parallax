// Orchestration: what happens between the reader asking for a split and getting one.
//
// Ordering matters here. Availability is checked before the overlay exists, so an
// unsupported language pair never costs two page loads. Translation only starts once both
// panes have a readable document, so a blocked site fails as a message rather than as two
// blank rectangles.
import { renderMessage } from "../chrome/i18n.ts";
import { describeFailure, ParallaxError } from "../shared/errors.ts";
import type { LanguagePair, PaneId, Preferences } from "../shared/types.ts";
import { adoptPane, openPane } from "./frames.ts";
import { diagnoseFraming, releaseFramingOverride, requestFramingOverride } from "./framing.ts";
import type { NavigationFollower } from "./navigation.ts";
import { createNavigationFollower, paneFrame, watchInPageNavigation } from "./navigation.ts";
import type { Overlay } from "./overlay.ts";
import { createOverlay } from "./overlay.ts";
import { pairDocuments } from "./pairing.ts";
import { createResizer } from "./resizer.ts";
import type { ScrollSync } from "./scroll-sync.ts";
import { createScrollSync } from "./scroll-sync.ts";
import { collectTextNodes } from "./text-nodes.ts";
import type { Queue, TranslationEngine, TranslationUnit } from "./translate-queue.ts";
import { createQueue } from "./translate-queue.ts";
import { checkAvailability, createTranslator } from "./translator.ts";
import { nodeUnit } from "./units.ts";

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
  /**
   * Whether a split is still running.
   *
   * Distinct from whether anything is on screen. Dragging the original away ends the split
   * but leaves the translation up to read, so this goes false while the overlay stays. The
   * controller can also close itself entirely, via Esc or by the translated pane being
   * dragged away, so holding a reference proves nothing — ask.
   */
  isActive(): boolean;
  toggleOrientation(): void;
  /**
   * Read both panes wherever they now are, and do the page over.
   *
   * The same work following a link triggers, reachable by hand — which is what makes it a
   * way out when a navigation goes unnoticed, as well as useful on its own: pages change
   * under a translation, and a translation can stop at a failure.
   */
  retranslate(): void;
  destroy(): void;
}

export interface ControllerHooks {
  /** Persist a ratio or orientation the reader settled on. */
  onPreferencesChanged(patch: Partial<Preferences>): void;
  /**
   * A site refused to be embedded. Remembered so the popup can offer an override — only an
   * extension page can call permissions.request, so this cannot be a button on the card.
   */
  onFrameBlocked(origin: string): void;
}

function groupByBlock(doc: Document, nodes: readonly Text[]) {
  const blocks: Element[] = [];
  const indexOf = new Map<Element, number>();
  const targets: TranslationUnit[] = [];

  for (const node of nodes) {
    const block = node.parentElement?.closest(BLOCK_SELECTOR) ?? doc.body;
    let index = indexOf.get(block);
    if (index === undefined) {
      index = blocks.length;
      indexOf.set(block, index);
      blocks.push(block);
    }
    targets.push(nodeUnit(node, index));
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

/**
 * The collaborators that reach outside this module: the Translator API, the frames, the
 * service worker, the DOM.
 *
 * Injected so the lifecycle here can be exercised without any of them. None can be stubbed
 * from a test otherwise — the Translator API does not exist in jsdom, an iframe never loads
 * there, and the overlay's shadow root is closed on purpose. Every bug found in this module
 * so far has been a lifecycle bug, which is exactly what this seam makes reachable.
 */
export interface ControllerDeps {
  checkAvailability: typeof checkAvailability;
  createTranslator: typeof createTranslator;
  openPane: typeof openPane;
  adoptPane: typeof adoptPane;
  requestFramingOverride: typeof requestFramingOverride;
  diagnoseFraming: typeof diagnoseFraming;
  releaseFramingOverride: typeof releaseFramingOverride;
  createOverlay: typeof createOverlay;
  paneFrame: typeof paneFrame;
}

const REAL_DEPS: ControllerDeps = {
  checkAvailability,
  createTranslator,
  openPane,
  adoptPane,
  requestFramingOverride,
  diagnoseFraming,
  releaseFramingOverride,
  createOverlay,
  paneFrame,
};

export async function startSplit(
  doc: Document,
  preferences: Preferences,
  hooks: ControllerHooks,
  deps: ControllerDeps = REAL_DEPS,
): Promise<Controller> {
  const pair: LanguagePair = {
    source: preferences.sourceLanguage,
    target: preferences.targetLanguage,
  };

  // Before anything is built, so a refusal costs nothing.
  const availability = await deps.checkAvailability(pair);

  // Before the frames exist, because the headers have to be rewritten on their first
  // request. Costs nothing on a site the reader has not granted: the worker returns without
  // fetching anything.
  const framing = await deps.requestFramingOverride(doc.location.href);

  const abort = new AbortController();
  const overlay = deps.createOverlay(doc, { url: doc.location.href });
  overlay.setRatio(preferences.ratio);
  overlay.setOrientation(preferences.orientation);

  let queue: Queue | null = null;
  let scrollSync: ScrollSync | null = null;
  let translator: TranslationEngine | null = null;
  let orientation = preferences.orientation;
  // Two separate questions. `splitting` is whether the reader is still comparing two panes;
  // `open` is whether anything of ours is on screen at all. Collapsing the original ends the
  // first without ending the second, and conflating them would leave Esc doing nothing.
  let splitting = true;
  let open = true;

  const controller: Controller = {
    isActive: () => open && splitting,

    retranslate: () => retranslate(),

    toggleOrientation() {
      orientation = orientation === "horizontal" ? "vertical" : "horizontal";
      // The ratio is deliberately left alone, so flipping the split keeps the reader's
      // chosen proportions rather than resetting them.
      overlay.setOrientation(orientation);
      hooks.onPreferencesChanged({ orientation });
    },

    destroy() {
      if (!open) {
        return;
      }
      open = false;
      splitting = false;
      abort.abort();
      void deps.releaseFramingOverride();
      queue?.destroy();
      translator?.destroy();
      overlay.destroy();
    },
  };

  overlay.onRequestClose(() => controller.destroy());

  /**
   * Re-read both panes wherever they now are, and do the page over.
   *
   * The same work a followed link triggers, reachable by hand. That makes it a recovery for
   * a navigation that went unnoticed as well as a feature in its own right: pages change
   * under a translation, and a translation can stop at a failure.
   */
  function retranslate(): void {
    const at = deps.paneFrame(overlay.frames.target).currentUrl();
    if (at === null) {
      overlay.showCard(renderMessage(describeFailure({ code: "FRAME_BLOCKED_UNKNOWN" })));
      return;
    }
    try {
      preparePage(
        deps.adoptPane(overlay.frames.source, at),
        deps.adoptPane(overlay.frames.target, at),
      );
    } catch (error) {
      reportBlocking(overlay, error);
      return;
    }
    if (translator === null) {
      // No session yet, because the reader had not accepted the language-pack download.
      // This click is the user activation create() wants, so it can be asked for now.
      runAndReport();
    }
  }

  /** The same panel the first translation is offered in, reached by following a link. */
  function offerRetranslate(): void {
    overlay.showCard(renderMessage({ key: "prompt_translate_page", substitutions: [] }), {
      label: renderMessage({ key: "action_retranslate", substitutions: [] }),
      onClick: retranslate,
    });
  }

  createResizer({
    container: overlay.container,
    handle: overlay.handle,
    orientation: () => orientation,
    initialRatio: preferences.ratio,
    onPreview: (ratio) => overlay.setRatio(ratio),
    onCollapsePreview: (pane) => overlay.setCollapsing(pane),
    onCommit(outcome) {
      if (outcome.kind === "split") {
        overlay.setRatio(outcome.ratio);
        hooks.onPreferencesChanged({ ratio: outcome.ratio });
        return;
      }
      collapse(outcome.collapsed);
    },
    signal: abort.signal,
  });

  /**
   * Dragging a pane away ends the split either way. What is left behind differs.
   *
   * Dragging away the translation puts the reader back on the original page, which is right
   * underneath, untouched and at the offset they left it.
   *
   * Dragging away the original leaves the translation up, full width, and stops being a
   * split. That reading is the point of the gesture — "I am done comparing, let me read
   * this" — and it also avoids throwing away translate() calls that are already paid for and
   * exist nowhere but in that frame. Translation in flight keeps running. Esc still closes
   * it, and asking for a split again rebuilds from scratch.
   */
  function collapse(pane: PaneId): void {
    if (pane === "target") {
      controller.destroy();
      return;
    }
    splitting = false;
    overlay.setMode("single-target");
    overlay.setStatus("ready", "Reading the translation. Press Esc to close.");
  }

  overlay.setStatus("idle", "Loading both panes…");

  let sourceDoc: Document;
  let targetDoc: Document;
  try {
    // allSettled rather than all: both panes load the same URL, so whatever refuses one
    // refuses the other, and Promise.all would leave the second rejection unhandled.
    const [source, target] = await Promise.allSettled([
      deps.openPane(overlay.frames.source, doc.location.href, abort.signal),
      deps.openPane(overlay.frames.target, doc.location.href, abort.signal),
    ]);
    if (source.status === "rejected") {
      throw source.reason;
    }
    if (target.status === "rejected") {
      throw target.reason;
    }
    sourceDoc = source.value;
    targetDoc = target.value;
  } catch (error) {
    // The site would not be embedded even with an override, so say why rather than offer
    // one that cannot help.
    if (framing.kind === "unsafe") {
      reportBlocking(
        overlay,
        new ParallaxError({
          code: "FRAMING_UNSAFE",
          detail: { reason: framing.reason },
        }),
      );
      return controller;
    }
    reportBlocking(overlay, error);
    if (error instanceof ParallaxError && error.code === "FRAME_BLOCKED") {
      /**
       * A refused embed has three quite different explanations, and only one of them is
       * worth asking the reader for a permission over.
       *
       * Which header refused takes a live request, so the card starts general and becomes
       * specific once the worker answers. Naming the wrong header would be worse than
       * naming none: X sends X-Frame-Options: SAMEORIGIN and frame-ancestors 'self', both
       * of which two same-origin panes satisfy — its refusal is not a header at all, and
       * no permission will change it.
       */
      void deps.diagnoseFraming(doc.location.href).then((refusal) => {
        if (!open) {
          return;
        }
        if (framing.kind === "armed") {
          // The permission was granted and the headers were rewritten, and it still would
          // not load. Do not offer the override again.
          overlay.showCard(
            renderMessage(describeFailure({ code: "FRAME_BLOCKED_DESPITE_OVERRIDE" })),
          );
          return;
        }
        if (refusal === null) {
          overlay.showCard(renderMessage(describeFailure({ code: "FRAME_BLOCKED_UNKNOWN" })));
          return;
        }
        overlay.showCard(
          renderMessage(describeFailure({ code: "FRAME_BLOCKED_BY", detail: { header: refusal } })),
        );
        // Recorded only here, so the popup offers an override exactly when one could help.
        hooks.onFrameBlocked(new URL(doc.location.href).origin);
      });
    }
    return controller;
  }

  const run = async (): Promise<void> => {
    try {
      translator = await deps.createTranslator(pair, {
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
    startTranslating();
  };

  /** @returns whether there was anything to translate. */
  function startTranslating(): boolean {
    const session = translator;
    if (session === null) {
      return false;
    }
    const { blocks, targets } = groupByBlock(targetDoc, collectTextNodes(targetDoc.body));
    if (targets.length === 0) {
      overlay.setStatus("ready", "Nothing on this page needs translating.");
      return true;
    }

    queue = createQueue({
      engine: session,
      onProgress(done, total) {
        overlay.setStatus("translating", `Translating ${done} of ${total}…`);
        if (done === total) {
          overlay.setStatus("ready", "Translated.");
        }
      },
      onCommit() {
        scrollSync?.invalidate();
      },
      onError(failure) {
        overlay.setStatus("error", renderMessage(describeFailure(failure)));
      },
      onWait(secondsLeft) {
        overlay.setStatus(
          "translating",
          renderMessage({ key: "status_rate_limited", substitutions: [String(secondsLeft)] }),
        );
      },
      signal: pageAbort.signal,
    });

    // openPane() has already proved this frame is same-origin and readable.
    const frameWindow = overlay.frames.target.contentWindow as Window & typeof globalThis;
    observeViewport(frameWindow, blocks, queue, pageAbort.signal);
    queue.enqueue(targets);
    return true;
  }

  // Everything below is per page, not per split. Following a link replaces both documents,
  // so the pairing, the scroll sync and the translation queue are all rebuilt — while the
  // overlay, the resizer and, importantly, the translator session survive. Reusing the
  // session is what makes the next page start translating at once instead of paying for
  // create() and a possible language-pack download again.
  let pageAbort = new AbortController();
  let follower: NavigationFollower | null = null;

  /** @returns whether translation started, so the caller can offer it if not. */
  function preparePage(source: Document, target: Document): boolean {
    pageAbort.abort();
    pageAbort = new AbortController();
    queue?.destroy();
    queue = null;
    scrollSync = null;

    // Pairing runs before any translation, while the two documents still hold the same
    // words. Failing it costs only the scroll sync — the split itself is unaffected — so it
    // is reported in the toolbar rather than as a card over the panes.
    try {
      const index = pairDocuments(source.body, target.body);
      scrollSync = createScrollSync({
        documents: { source, target },
        index,
        signal: pageAbort.signal,
      });
    } catch (error) {
      if (error instanceof ParallaxError) {
        overlay.setStatus("error", renderMessage(describeFailure(error.failure)));
      } else {
        throw error;
      }
    }

    // Re-attached per page: a single-page app routes with pushState and never reloads the
    // frame, so its element's load event says nothing. The Navigation object belongs to the
    // document, so it goes with the page it was read from.
    for (const pane of ["source", "target"] as const) {
      const view = (pane === "source" ? source : target).defaultView;
      if (view !== null) {
        watchInPageNavigation(view, () => follower?.check(), pageAbort.signal);
      }
    }

    targetDoc = target;
    if (translator === null) {
      return false;
    }
    overlay.hideCard();
    return startTranslating();
  }

  // Never `void run()`. Anything thrown past the translator's own catch — a frame that went
  // away, a realm without the observer — would otherwise become an unhandled rejection and
  // leave the reader looking at an untranslated pane with nothing to explain it.
  const runAndReport = (): void => {
    run().catch((error: unknown) => {
      overlay.setStatus(
        "error",
        renderMessage(
          describeFailure({
            code: "TRANSLATE_FAILED",
            detail: {
              done: 0,
              total: 0,
              reason: error instanceof Error ? error.message : String(error),
            },
          }),
        ),
      );
    });
  };

  preparePage(sourceDoc, targetDoc);

  follower = createNavigationFollower({
    frames: {
      source: deps.paneFrame(overlay.frames.source),
      target: deps.paneFrame(overlay.frames.target),
    },
    origin: new URL(doc.location.href).origin,
    startedAt: doc.location.href,
    onNavigated(url) {
      // Offered first, and withdrawn by preparePage the moment translation starts. When it
      // starts the panel never paints; when it does not, the reader is left holding the way
      // to ask for it rather than a page silently in its own language.
      offerRetranslate();
      try {
        preparePage(
          deps.adoptPane(overlay.frames.source, url),
          deps.adoptPane(overlay.frames.target, url),
        );
      } catch (error) {
        reportBlocking(overlay, error);
      }
    },
    onLeftOrigin() {
      // Following a link off the site is not a failure to report, it is the reader leaving.
      // Closing puts them back on the page they started from, at the offset they left it.
      controller.destroy();
    },
    signal: abort.signal,
  });

  if (availability === "available") {
    runAndReport();
  } else {
    // create() needs transient activation before it will download a pack, and a click on the
    // toolbar icon does not give the page any. This click does.
    overlay.showCard(`Translate this page into ${pair.target}?`, {
      label: "Translate",
      onClick: runAndReport,
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

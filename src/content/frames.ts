// Getting a usable document out of each pane's iframe, or saying exactly why there isn't one.
import { FRAME_LOAD_TIMEOUT_MS } from "../shared/constants.ts";
import { ParallaxError } from "../shared/errors.ts";
import { isBlankUrl, isSameDocument } from "../shared/url.ts";

/**
 * Stop the browser translating a pane behind our back.
 *
 * Chrome's own page translation treats same-origin subframes as part of the tab, so a reader
 * with "always translate English" enabled would get *both* panes translated and the original
 * would stop being the original.
 *
 * This has to be the meta tag rather than `translate="no"` on the root element: text-nodes.ts
 * honours author opt-outs via closest('[translate="no"]'), and a marker on the root would
 * match every node in the document — which, measured, silently reduced the translatable node
 * count to zero.
 */
function suppressBrowserTranslation(doc: Document): void {
  const meta = doc.createElement("meta");
  meta.name = "google";
  meta.content = "notranslate";
  doc.head.prepend(meta);
}

function whenLoaded(frame: HTMLIFrameElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new ParallaxError({
          code: "FRAME_LOAD_TIMEOUT",
          detail: { seconds: Math.round(FRAME_LOAD_TIMEOUT_MS / 1000) },
        }),
      );
    }, FRAME_LOAD_TIMEOUT_MS);

    frame.addEventListener(
      "load",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true, signal },
    );
  });
}

/**
 * Wait for a pane to load and hand back its document.
 *
 * @throws ParallaxError FRAME_LOAD_TIMEOUT, FRAME_BLOCKED or FRAME_BUSTED. A blocked frame
 * still fires `load` — for the browser's own error page — so the refusal shows up as an
 * unreadable contentDocument rather than as a missing event.
 */
export async function openPane(
  frame: HTMLIFrameElement,
  expectedUrl: string,
  signal: AbortSignal,
): Promise<Document> {
  await whenLoaded(frame, signal);

  let doc: Document | null = null;
  try {
    doc = frame.contentDocument;
  } catch {
    // A cross-origin error page: the site refused the embed.
    doc = null;
  }
  if (doc === null || doc.body === null) {
    throw new ParallaxError({ code: "FRAME_BLOCKED" });
  }

  // Where the frame actually ended up. Reading its document is not evidence the page loaded:
  // a frame refused by CSP frame-ancestors fires `load` while still on the initial empty
  // document, which is same-origin and reads perfectly well. Only the URL tells them apart.
  const actual = frame.contentWindow?.location.href ?? "";
  if (isBlankUrl(actual)) {
    throw new ParallaxError({ code: "FRAME_BLOCKED" });
  }
  // The sandbox withholds allow-top-navigation, so a frame-busting site cannot take the tab
  // with it. It can still navigate itself away, which leaves a pane showing the wrong page.
  if (!isSameDocument(expectedUrl, actual)) {
    throw new ParallaxError({ code: "FRAME_BUSTED" });
  }

  suppressBrowserTranslation(doc);
  return doc;
}

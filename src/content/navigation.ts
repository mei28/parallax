// Following a link with both panes.
//
// A link clicked in one pane navigates only that pane. The other has to be sent after it,
// and the page then done over — paired afresh, translated afresh.
//
// This asks where the panes are rather than tracking how they got there. An earlier version
// chained events — the leader's load, then the follower's load, then report — and one link in
// that chain not firing stopped everything with nothing to show for it. Here every load, and
// every in-page route change, asks the same question: are both panes on one page, and is it a
// page not yet prepared? Nothing depends on which event arrives, or on how many do.
//
// The frames are behind an interface rather than used directly, because where a pane is and
// where it is being sent are not observable in a test through an HTMLIFrameElement.
import type { PaneId } from "../shared/types.ts";
import { isSameDocument } from "../shared/url.ts";

export interface PaneFrame {
  /** Where the pane is now, or null when its document cannot be reached. */
  currentUrl(): string | null;
  navigate(url: string): void;
  onLoad(handler: () => void, signal: AbortSignal): void;
}

export interface NavigationOptions {
  frames: Readonly<Record<PaneId, PaneFrame>>;
  origin: string;
  startedAt: string;
  /** Both panes are now on this page, and it needs pairing and translating afresh. */
  onNavigated: (url: string) => void;
  /**
   * A pane has gone somewhere the split cannot follow. The split ends: reading another site
   * is a perfectly ordinary thing to want, and the reader gets their tab back to do it.
   */
  onLeftOrigin: (url: string) => void;
  signal: AbortSignal;
}

export interface NavigationFollower {
  /**
   * Look at where both panes are.
   *
   * Called for each frame's load event, and again from inside each pane for routes that
   * never reload it — a single-page app navigating with pushState leaves the frame element
   * silent, so watching only its load event misses every link on sites like GitHub.
   */
  check(): void;
}

/** Wrap a real iframe for the follower to drive. */
export function paneFrame(frame: HTMLIFrameElement): PaneFrame {
  return {
    currentUrl() {
      try {
        return frame.contentWindow?.location.href ?? null;
      } catch {
        // Cross-origin: the pane went somewhere we cannot follow it.
        return null;
      }
    },
    navigate(url) {
      frame.src = url;
    },
    onLoad(handler, signal) {
      frame.addEventListener("load", handler, { signal });
    },
  };
}

export function createNavigationFollower(options: NavigationOptions): NavigationFollower {
  const { frames, signal } = options;

  /** The page both panes were last prepared for. */
  let prepared = options.startedAt;
  /** Where a pane has been sent but has not arrived yet, so it is not sent twice. */
  let pending: string | null = null;

  /**
   * When a pane has been sent somewhere, look again shortly after in case nothing told us it
   * arrived.
   *
   * Its load event should say so, and normally does. But a navigation is in flight and we
   * know it: verifying that it landed is cheaper than trusting one event to fire, and this
   * feature has already been shipped twice on that trust and silently done nothing. The
   * checks stop as soon as the panes agree, and stop regardless after a few seconds.
   */
  const ARRIVAL_CHECKS_MS = [150, 500, 1500, 4000] as const;
  const confirmArrival = (): void => {
    for (const delay of ARRIVAL_CHECKS_MS) {
      const timer = setTimeout(() => {
        if (pending !== null) {
          check();
        }
      }, delay);
      signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
    }
  };

  const check = (): void => {
    const source = frames.source.currentUrl();
    const target = frames.target.currentUrl();
    if (source === null || target === null) {
      options.onLeftOrigin("");
      return;
    }
    for (const url of [source, target]) {
      if (new URL(url).origin !== options.origin) {
        options.onLeftOrigin(url);
        return;
      }
    }

    if (isSameDocument(source, target)) {
      pending = null;
      if (!isSameDocument(source, prepared)) {
        prepared = source;
        options.onNavigated(source);
      }
      return;
    }

    // They disagree, so one has moved. Whichever is no longer where the split was is the one
    // the reader followed a link in.
    const leader: PaneId = isSameDocument(source, prepared) ? "target" : "source";
    const destination = leader === "source" ? source : target;
    if (pending !== null && isSameDocument(pending, destination)) {
      return;
    }
    pending = destination;
    frames[leader === "source" ? "target" : "source"].navigate(destination);
    confirmArrival();
  };

  for (const pane of ["source", "target"] as const) {
    frames[pane].onLoad(check, signal);
  }

  return { check };
}

/**
 * Report a pane's in-page navigations.
 *
 * The Navigation object belongs to the document, not to the frame, so this has to be
 * re-attached whenever a pane adopts a new page — which is why it takes the per-page signal
 * rather than the split's.
 */
export function watchInPageNavigation(
  view: Window & typeof globalThis,
  onNavigate: () => void,
  signal: AbortSignal,
): void {
  view.navigation?.addEventListener("navigatesuccess", onNavigate, { signal });
}

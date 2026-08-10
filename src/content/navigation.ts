// Following a link with both panes.
//
// A link clicked in one pane navigates only that pane, which would leave the two showing
// different pages. The other is sent after it, and the load that causes has to be told apart
// from the reader navigating again — the same echo problem the scroll sync has, in URLs.
//
// The frames are behind an interface rather than used directly, because what matters here is
// where a pane is and where it is being sent, and neither is observable in a test through an
// HTMLIFrameElement.

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
  /** Leaving this ends what the split can do: another origin is another document to us. */
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

export interface NavigationFollower {
  /**
   * Look at where a pane is now.
   *
   * Called for the frame's own load event, and again from inside each pane for navigations
   * that never reload it — a single-page app routing with pushState leaves the frame element
   * silent, so watching only its load event misses every link on sites like GitHub.
   */
  check(pane: PaneId): void;
}

export function createNavigationFollower(options: NavigationOptions): NavigationFollower {
  const { frames, signal } = options;
  const other = (pane: PaneId): PaneId => (pane === "source" ? "target" : "source");

  let current = options.startedAt;
  let following = false;

  const onLoad = (pane: PaneId): void => {
    if (following) {
      // The other pane catching up with a page we already know about.
      return;
    }
    const arrived = frames[pane].currentUrl();
    if (arrived === null) {
      // Unreadable means another origin: the pane went somewhere the split cannot go.
      options.onLeftOrigin("");
      return;
    }
    // Compared without the fragment, which loads nothing new, and so is not a navigation
    // either pane needs to hear about.
    if (isSameDocument(current, arrived)) {
      return;
    }
    if (new URL(arrived).origin !== options.origin) {
      options.onLeftOrigin(arrived);
      return;
    }

    current = arrived;
    following = true;
    const follower = other(pane);
    let settled = false;
    frames[follower].onLoad(() => {
      if (settled) {
        return;
      }
      settled = true;
      following = false;
      options.onNavigated(arrived);
    }, signal);
    frames[follower].navigate(arrived);
  };

  for (const pane of ["source", "target"] as const) {
    frames[pane].onLoad(() => onLoad(pane), signal);
  }

  return { check: onLoad };
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

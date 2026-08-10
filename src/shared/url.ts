// Which pages parallax can split.

const BLOCKED_PROTOCOLS: ReadonlySet<string> = new Set([
  // Chrome's own surfaces; extensions cannot script them.
  "chrome:",
  "chrome-extension:",
  "chrome-untrusted:",
  "devtools:",
  "about:",
  "edge:",
  "view-source:",
  // Local files need a permission the user grants per extension, and the two iframes would
  // each re-read the file rather than share the tab's document.
  "file:",
  "blob:",
  "data:",
]);

/** Hosts where Chrome refuses content scripts regardless of permissions. */
const BLOCKED_HOSTS: ReadonlySet<string> = new Set([
  "chromewebstore.google.com",
  "chrome.google.com",
]);

/**
 * Whether a frame is still sitting on the initial empty document.
 *
 * A frame refused by CSP frame-ancestors fires `load` having gone nowhere at all. The empty
 * document it stays on is same-origin and perfectly readable, so being able to reach a
 * frame's document says nothing about whether the page arrived — this does.
 */
export function isBlankUrl(url: string): boolean {
  return url === "" || url === "about:blank" || url.startsWith("about:blank#");
}

/**
 * Whether a frame ended up on the page it was asked for.
 *
 * Compared by origin, path and query, because the browser normalises a missing trailing
 * slash and a fragment never reaches the server, while a different query is a different
 * page. Anything unparseable is not a match; there is nothing sensible to assume.
 */
export function isSameDocument(requested: string, actual: string): boolean {
  let left: URL;
  let right: URL;
  try {
    left = new URL(requested);
    right = new URL(actual);
  } catch {
    return false;
  }
  return (
    left.origin === right.origin && left.pathname === right.pathname && left.search === right.search
  );
}

/**
 * Whether a split view can be started on this URL.
 *
 * The popup calls this before injecting anything, so an unsupported page is a disabled
 * button with a reason rather than an injection that fails halfway.
 */
export function isSplittableUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Not a URL at all, so not a page that can be split. Nothing is being recovered from.
    return false;
  }
  if (BLOCKED_PROTOCOLS.has(parsed.protocol)) {
    return false;
  }
  return !BLOCKED_HOSTS.has(parsed.hostname);
}

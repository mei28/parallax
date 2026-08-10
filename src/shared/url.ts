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

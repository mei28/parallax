// Which pages can be split at all. The popup uses this to disable Start before anything is
// injected, so the reason is visible up front rather than as a failed injection.
import { describe, expect, it } from "vitest";
import { isBlankUrl, isSameDocument, isSplittableUrl } from "../../src/shared/url.ts";

describe("isSplittableUrl", () => {
  it("accepts ordinary web pages", () => {
    expect(isSplittableUrl("https://example.com/article")).toBe(true);
    expect(isSplittableUrl("http://localhost:3000/article.html")).toBe(true);
  });

  it("rejects Chrome's own pages, which extensions cannot script", () => {
    expect(isSplittableUrl("chrome://extensions")).toBe(false);
    expect(isSplittableUrl("chrome-extension://abcdef/popup.html")).toBe(false);
    expect(isSplittableUrl("devtools://devtools/bundled/inspector.html")).toBe(false);
    expect(isSplittableUrl("about:blank")).toBe(false);
  });

  it("rejects view-source, which has no document to translate", () => {
    expect(isSplittableUrl("view-source:https://example.com")).toBe(false);
  });

  it("rejects local files, which extensions cannot read without file access", () => {
    expect(isSplittableUrl("file:///Users/mei/note.html")).toBe(false);
  });

  it("rejects the Chrome Web Store, where content scripts are refused", () => {
    expect(isSplittableUrl("https://chromewebstore.google.com/detail/abc")).toBe(false);
  });

  it("rejects anything that is not a URL", () => {
    expect(isSplittableUrl("not a url")).toBe(false);
    expect(isSplittableUrl("")).toBe(false);
  });
});

// A frame refused by CSP frame-ancestors still fires `load`, having gone nowhere. It sits on
// the initial empty document, which is same-origin and therefore perfectly readable — so
// "the document can be read" is not evidence the page loaded.
describe("isBlankUrl", () => {
  it("recognises the initial empty document", () => {
    expect(isBlankUrl("about:blank")).toBe(true);
    expect(isBlankUrl("about:blank#anything")).toBe(true);
    expect(isBlankUrl("")).toBe(true);
  });

  it("does not mistake a real page for it", () => {
    expect(isBlankUrl("https://github.com/")).toBe(false);
  });
});

describe("isSameDocument", () => {
  it("accepts a URL that came back unchanged", () => {
    expect(isSameDocument("https://github.com/features", "https://github.com/features")).toBe(true);
  });

  it("ignores a trailing slash the browser normalised in", () => {
    expect(isSameDocument("https://github.com", "https://github.com/")).toBe(true);
  });

  it("ignores the fragment, which never reaches the server", () => {
    expect(isSameDocument("https://a.test/x", "https://a.test/x#section")).toBe(true);
  });

  it("keeps the query, because it selects the content", () => {
    expect(isSameDocument("https://a.test/s?q=1", "https://a.test/s?q=2")).toBe(false);
  });

  it("rejects a different path, which means the site navigated itself away", () => {
    expect(isSameDocument("https://a.test/x", "https://a.test/login")).toBe(false);
  });

  it("rejects a different origin", () => {
    expect(isSameDocument("https://a.test/x", "https://b.test/x")).toBe(false);
  });

  it("rejects anything unparseable rather than guessing", () => {
    expect(isSameDocument("https://a.test/x", "about:blank")).toBe(false);
  });
});

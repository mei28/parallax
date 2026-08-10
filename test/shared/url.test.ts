// Which pages can be split at all. The popup uses this to disable Start before anything is
// injected, so the reason is visible up front rather than as a failed injection.
import { describe, expect, it } from "vitest";
import { isSplittableUrl } from "../../src/shared/url.ts";

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

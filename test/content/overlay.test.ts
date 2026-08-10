// @vitest-environment jsdom
// Overlay tests.
//
// The prior art this replaces (babelize) did `document.body.innerHTML = ""`, which is why it
// had no way back to the original page. Here the page is left standing and covered, so
// teardown is a genuine restore rather than a reload — which is also what makes collapsing
// the translated pane cheap: the original is right underneath, at its original offset.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOverlay } from "../../src/content/overlay.ts";
import { ATTR_HOST, CSS_VAR_RATIO } from "../../src/shared/constants.ts";

beforeEach(() => {
  document.documentElement.removeAttribute("style");
  document.body.innerHTML = "<main>the original page</main>";
  window.scrollTo = vi.fn();
});

afterEach(() => {
  document.querySelector(`[${ATTR_HOST}]`)?.remove();
});

describe("createOverlay", () => {
  it("adds exactly one element, and leaves the page's own DOM alone", () => {
    const before = document.body.innerHTML;

    createOverlay(document, { url: "https://example.com/" });

    expect(document.querySelectorAll(`[${ATTR_HOST}]`)).toHaveLength(1);
    expect(document.body.innerHTML).toBe(before);
  });

  it("stops the page underneath from scrolling", () => {
    createOverlay(document, { url: "https://example.com/" });

    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("points both frames at the same URL", () => {
    const overlay = createOverlay(document, { url: "https://example.com/article" });

    expect(overlay.frames.source.getAttribute("src")).toBe("https://example.com/article");
    expect(overlay.frames.target.getAttribute("src")).toBe("https://example.com/article");
  });

  it("blocks top navigation, so a frame-busting site cannot take the tab with it", () => {
    const overlay = createOverlay(document, { url: "https://example.com/" });

    const sandbox = overlay.frames.source.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-same-origin");
    expect(sandbox).not.toContain("allow-top-navigation");
  });

  it("writes the split ratio as a custom property", () => {
    const overlay = createOverlay(document, { url: "https://example.com/" });

    overlay.setRatio(0.25);

    expect(overlay.container.style.getPropertyValue(CSS_VAR_RATIO)).toBe("0.25");
  });

  it("keeps the ratio when the orientation flips", () => {
    const overlay = createOverlay(document, { url: "https://example.com/" });
    overlay.setRatio(0.3);

    overlay.setOrientation("vertical");

    expect(overlay.container.dataset.parallaxOrientation).toBe("vertical");
    expect(overlay.container.style.getPropertyValue(CSS_VAR_RATIO)).toBe("0.3");
  });
});

describe("Overlay.destroy", () => {
  it("removes everything it added", () => {
    const overlay = createOverlay(document, { url: "https://example.com/" });

    overlay.destroy();

    expect(document.querySelector(`[${ATTR_HOST}]`)).toBeNull();
    expect(document.body.innerHTML).toBe("<main>the original page</main>");
  });

  it("restores the page's own overflow value verbatim", () => {
    document.documentElement.style.overflow = "clip";
    const overlay = createOverlay(document, { url: "https://example.com/" });

    overlay.destroy();

    expect(document.documentElement.style.overflow).toBe("clip");
  });

  it("leaves no inline style behind when the page had none", () => {
    const overlay = createOverlay(document, { url: "https://example.com/" });

    overlay.destroy();

    expect(document.documentElement.style.overflow).toBe("");
  });

  it("puts the reader back where they were", () => {
    vi.spyOn(window, "scrollX", "get").mockReturnValue(0);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(840);
    const overlay = createOverlay(document, { url: "https://example.com/" });

    overlay.destroy();

    expect(window.scrollTo).toHaveBeenCalledWith(0, 840);
  });

  it("can be called twice without throwing", () => {
    const overlay = createOverlay(document, { url: "https://example.com/" });

    overlay.destroy();

    expect(() => overlay.destroy()).not.toThrow();
  });
});

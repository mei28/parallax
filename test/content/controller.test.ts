// @vitest-environment jsdom
// Split lifecycle tests.
//
// Every bug this module has produced has been a lifecycle bug: a refused frame read as a
// successful one, "is a split running" tracked in two places that disagreed, an exception
// that vanished. None of them were reachable from a test until the collaborators became
// injectable, because the Translator API does not exist in jsdom, an iframe never loads
// there, and the overlay's shadow root is closed on purpose.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ControllerDeps, ControllerHooks } from "../../src/content/controller.ts";
import { startSplit } from "../../src/content/controller.ts";
import type { PaneFrame } from "../../src/content/navigation.ts";
import type { Overlay } from "../../src/content/overlay.ts";
import { DEFAULT_PREFERENCES } from "../../src/shared/constants.ts";
import { ParallaxError } from "../../src/shared/errors.ts";

/** An overlay of real elements, so the resizer can be driven, but with nothing hidden. */
function fakeOverlay() {
  const container = document.createElement("div");
  const handle = document.createElement("button");
  container.append(handle);
  document.body.append(container);
  container.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1008, height: 800 }) as DOMRect;
  handle.setPointerCapture = vi.fn();
  handle.releasePointerCapture = vi.fn();

  // Attached, because a detached iframe has no contentWindow in jsdom and the controller
  // needs the target frame's realm to build its viewport observer.
  const frame = () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    // The viewport observer is built in the pane's own realm, and jsdom gives each iframe a
    // realm without one. Chrome gives every realm an IntersectionObserver.
    const view = iframe.contentWindow as (Window & { IntersectionObserver?: unknown }) | null;
    if (view !== null && view.IntersectionObserver === undefined) {
      view.IntersectionObserver = window.IntersectionObserver;
    }
    return iframe;
  };
  let closeHandler: (() => void) | null = null;
  let cardAction: (() => void) | null = null;

  const overlay: Overlay & { calls: string[]; requestClose(): void; retranslate(): void } = {
    container,
    handle,
    panes: { source: document.createElement("div"), target: document.createElement("div") },
    frames: { source: frame(), target: frame() },
    calls: [],
    setRatio: vi.fn(),
    setOrientation: vi.fn(),
    setMode: vi.fn((mode: string) => void overlay.calls.push(`mode:${mode}`)),
    setCollapsing: vi.fn(),
    setStatus: vi.fn(),
    setProgress: vi.fn(),
    showCard: vi.fn((text: string, action?: { onClick: () => void }) => {
      overlay.calls.push(`card:${text}`);
      cardAction = action?.onClick ?? null;
    }),
    hideCard: vi.fn(),
    onRequestClose: (handler) => {
      closeHandler = handler;
    },
    destroy: vi.fn(() => void overlay.calls.push("destroy")),
    requestClose: () => closeHandler?.(),
    // Press the button the panel offers, whatever it is offering.
    retranslate: () => cardAction?.(),
  };
  return overlay;
}

function paneDocument(html = "<p>Hello</p>"): Document {
  const doc = document.implementation.createHTMLDocument("pane");
  doc.body.innerHTML = html;
  return doc;
}

let overlay: ReturnType<typeof fakeOverlay>;
let hooks: ControllerHooks & { blocked: string[] };

/** An engine that brackets each text, built on a per-text function the test can watch. */
function fakeEngine(translate: (text: string) => Promise<string> = async (t) => `[${t}]`) {
  return {
    translateBatch: async (texts: readonly string[]) => Promise.all(texts.map(translate)),
    destroy: vi.fn(),
  };
}

function deps(overrides: Partial<ControllerDeps> = {}): ControllerDeps {
  return {
    checkAvailability: async () => "available",
    createTranslator: async () => fakeEngine(),
    openPane: async () => paneDocument(),
    adoptPane: () => paneDocument(),
    requestFramingOverride: async () => ({ kind: "no-permission" }),
    diagnoseFraming: async () => null,
    releaseFramingOverride: async () => {},
    createOverlay: () => overlay,
    paneFrame: (frame: HTMLIFrameElement): PaneFrame => ({
      currentUrl: () => frame.src,
      navigate: () => {},
      onLoad: () => {},
    }),
    ...overrides,
  };
}

function pointer(type: string, x: number): PointerEvent {
  return new MouseEvent(type, { clientX: x, clientY: 0, bubbles: true }) as unknown as PointerEvent;
}

beforeEach(() => {
  document.body.innerHTML = "";
  overlay = fakeOverlay();
  hooks = {
    onPreferencesChanged: vi.fn(),
    onFrameBlocked: vi.fn((origin: string) => void hooks.blocked.push(origin)),
    blocked: [],
  };
});

describe("startSplit", () => {
  it("reports a running split once both panes are open", async () => {
    const controller = await startSplit(document, DEFAULT_PREFERENCES, hooks, deps());

    expect(controller.isActive()).toBe(true);
  });

  it("refuses before building anything when the pair cannot be translated", async () => {
    const createOverlay = vi.fn(() => overlay);
    const failing = deps({
      createOverlay,
      checkAvailability: async () => {
        throw new ParallaxError({
          code: "TRANSLATION_UNAVAILABLE",
          detail: { source: "en", target: "ja" },
        });
      },
    });

    await expect(startSplit(document, DEFAULT_PREFERENCES, hooks, failing)).rejects.toThrow(
      ParallaxError,
    );
    // Two extra page loads are not spent on a pair that was never going to work.
    expect(createOverlay).not.toHaveBeenCalled();
  });
});

describe("closing", () => {
  it("takes the overlay down and stops reporting a split", async () => {
    const controller = await startSplit(document, DEFAULT_PREFERENCES, hooks, deps());

    controller.destroy();

    expect(overlay.destroy).toHaveBeenCalled();
    expect(controller.isActive()).toBe(false);
  });

  it("survives being closed twice", async () => {
    const controller = await startSplit(document, DEFAULT_PREFERENCES, hooks, deps());

    controller.destroy();

    expect(() => controller.destroy()).not.toThrow();
    expect(overlay.destroy).toHaveBeenCalledOnce();
  });

  it("closes on Esc, and says so afterwards", async () => {
    const controller = await startSplit(document, DEFAULT_PREFERENCES, hooks, deps());

    overlay.requestClose();

    expect(controller.isActive()).toBe(false);
    expect(overlay.destroy).toHaveBeenCalled();
  });

  it("puts the site's framing rules back", async () => {
    const releaseFramingOverride = vi.fn(async () => {});
    const controller = await startSplit(
      document,
      DEFAULT_PREFERENCES,
      hooks,
      deps({ releaseFramingOverride }),
    );

    controller.destroy();

    expect(releaseFramingOverride).toHaveBeenCalled();
  });
});

// The asymmetry a reader found confusing, pinned down. Both gestures end the split; they
// differ in what is left on screen.
describe("dragging a pane away", () => {
  async function dragTo(x: number) {
    const controller = await startSplit(document, DEFAULT_PREFERENCES, hooks, deps());
    overlay.handle.dispatchEvent(pointer("pointerdown", 504));
    overlay.handle.dispatchEvent(pointer("pointermove", x));
    overlay.handle.dispatchEvent(pointer("pointerup", x));
    return controller;
  }

  it("ends everything when the translation is the pane dragged away", async () => {
    const controller = await dragTo(1000);

    expect(overlay.destroy).toHaveBeenCalled();
    expect(controller.isActive()).toBe(false);
  });

  it("keeps the translation up when the original is the pane dragged away", async () => {
    const controller = await dragTo(8);

    expect(overlay.destroy).not.toHaveBeenCalled();
    expect(overlay.setMode).toHaveBeenCalledWith("single-target");
    // No longer a split, so the popup offers to start one rather than to stop one.
    expect(controller.isActive()).toBe(false);
  });

  it("still closes on Esc after the original was dragged away", async () => {
    await dragTo(8);

    overlay.requestClose();

    expect(overlay.destroy).toHaveBeenCalled();
  });
});

describe("a site that refuses to be embedded", () => {
  const blocked = () =>
    deps({
      openPane: async () => {
        throw new ParallaxError({ code: "FRAME_BLOCKED" });
      },
    });

  it("says so on the card instead of showing two empty panes", async () => {
    await startSplit(document, DEFAULT_PREFERENCES, hooks, blocked());

    expect(overlay.calls.some((call) => call.startsWith("card:"))).toBe(true);
  });

  it("records the origin when a header is to blame, so the popup can offer an override", async () => {
    await startSplit(document, DEFAULT_PREFERENCES, hooks, {
      ...blocked(),
      diagnoseFraming: async () => "X-Frame-Options: DENY",
    } as ControllerDeps);
    await Promise.resolve();

    expect(hooks.blocked).toEqual([window.location.origin]);
  });

  // X permits same-origin framing in both headers and still will not load. Offering a
  // permission there would take something from the reader and give nothing back.
  it("offers no override when the headers already permit embedding", async () => {
    await startSplit(document, DEFAULT_PREFERENCES, hooks, {
      ...blocked(),
      diagnoseFraming: async () => null,
    } as ControllerDeps);
    await Promise.resolve();

    expect(hooks.blocked).toEqual([]);
    expect(overlay.calls.at(-1)).toContain("error_frame_blocked_unknown");
  });

  it("says the permission did not help rather than offering it again", async () => {
    await startSplit(document, DEFAULT_PREFERENCES, hooks, {
      ...blocked(),
      requestFramingOverride: async () => ({ kind: "armed" }),
      diagnoseFraming: async () => "X-Frame-Options: DENY",
    } as ControllerDeps);
    await Promise.resolve();

    expect(hooks.blocked).toEqual([]);
    expect(overlay.calls.at(-1)).toContain("error_frame_blocked_despite_override");
  });

  it("does not offer an override that could not be granted safely", async () => {
    await startSplit(
      document,
      DEFAULT_PREFERENCES,
      hooks,
      deps({
        requestFramingOverride: async () => ({ kind: "unsafe", reason: "nonce" }),
        openPane: async () => {
          throw new ParallaxError({ code: "FRAME_BLOCKED" });
        },
      }),
    );

    expect(hooks.blocked).toEqual([]);
  });

  it("never reaches the translator", async () => {
    const createTranslator = vi.fn();
    await startSplit(document, DEFAULT_PREFERENCES, hooks, {
      ...blocked(),
      createTranslator,
    } as ControllerDeps);

    expect(createTranslator).not.toHaveBeenCalled();
  });
});

// Following a link is the difference between a reading session and a single page.
//
// Driven through fake panes: a jsdom iframe never leaves about:blank, so a test that just
// dispatches load events at real ones proves nothing — an earlier version of this suite did
// exactly that and passed while the feature did nothing.
describe("following a link", () => {
  function fakePane(url: string) {
    const handlers: (() => void)[] = [];
    return {
      visited: [] as string[],
      currentUrl: () => url,
      navigate(to: string) {
        this.visited.push(to);
        url = to;
        for (const handler of [...handlers]) handler();
      },
      onLoad: (handler: () => void) => handlers.push(handler),
      /** The reader clicking a link in this pane. */
      go(to: string) {
        url = to;
        for (const handler of [...handlers]) handler();
      },
    };
  }

  const HOME = window.location.href;
  const NEXT = new URL("/next", window.location.href).href;

  function navigableDeps(overrides: Partial<ControllerDeps> = {}) {
    const panes = { source: fakePane(HOME), target: fakePane(HOME) };
    return {
      panes,
      deps: deps({
        paneFrame: ((frame: HTMLIFrameElement) =>
          frame === overlay.frames.source ? panes.source : panes.target) as never,
        ...overrides,
      }),
    };
  }

  it("translates the page it followed to", async () => {
    const translate = vi.fn(async (text: string) => `[${text}]`);
    const { panes, deps: d } = navigableDeps({
      createTranslator: async () => fakeEngine(translate),
    });
    await startSplit(document, DEFAULT_PREFERENCES, hooks, d);
    await new Promise((resolve) => setTimeout(resolve));
    translate.mockClear();

    panes.source.go(NEXT);
    await new Promise((resolve) => setTimeout(resolve));

    expect(panes.target.visited).toEqual([NEXT]);
    expect(translate).toHaveBeenCalled();
  });

  it("keeps the translator session, so the next page needs no download", async () => {
    const createTranslator = vi.fn(async () => fakeEngine());
    const { panes, deps: d } = navigableDeps({ createTranslator });
    await startSplit(document, DEFAULT_PREFERENCES, hooks, d);
    await new Promise((resolve) => setTimeout(resolve));

    panes.source.go(NEXT);
    await new Promise((resolve) => setTimeout(resolve));

    expect(createTranslator).toHaveBeenCalledOnce();
  });

  it("takes its offer back once the new page starts translating", async () => {
    const { panes, deps: d } = navigableDeps();
    await startSplit(document, DEFAULT_PREFERENCES, hooks, d);
    await new Promise((resolve) => setTimeout(resolve));

    panes.source.go(NEXT);
    await new Promise((resolve) => setTimeout(resolve));

    expect(overlay.hideCard).toHaveBeenCalled();
  });

  // The way out when a navigation is not noticed. Offered in the same panel the first
  // translation is, rather than as a control the reader has to hunt for.
  it("leaves the offer up, and honours it, when nothing translated by itself", async () => {
    const translate = vi.fn(async (text: string) => `[${text}]`);
    const { panes, deps: d } = navigableDeps({
      // No translator yet: the reader has not accepted the language-pack download.
      checkAvailability: async () => "downloadable",
      createTranslator: async () => fakeEngine(translate),
    });
    await startSplit(document, DEFAULT_PREFERENCES, hooks, d);
    await new Promise((resolve) => setTimeout(resolve));

    panes.source.go(NEXT);
    await new Promise((resolve) => setTimeout(resolve));
    expect(overlay.calls.at(-1)).toContain("prompt_translate_page");

    overlay.retranslate();
    await new Promise((resolve) => setTimeout(resolve));

    expect(translate).toHaveBeenCalled();
  });

  it("closes the split at a link leading off the site", async () => {
    const { panes, deps: d } = navigableDeps();
    await startSplit(document, DEFAULT_PREFERENCES, hooks, d);
    await new Promise((resolve) => setTimeout(resolve));

    panes.source.go("https://elsewhere.test/page");
    await new Promise((resolve) => setTimeout(resolve));

    expect(panes.target.visited).toEqual([]);
    // Reading another site is an ordinary thing to want; the reader gets their tab back.
    expect(overlay.destroy).toHaveBeenCalled();
  });
});

describe("orientation", () => {
  it("flips and remembers, without disturbing the ratio", async () => {
    const controller = await startSplit(document, DEFAULT_PREFERENCES, hooks, deps());

    controller.toggleOrientation();

    expect(overlay.setOrientation).toHaveBeenLastCalledWith("vertical");
    expect(hooks.onPreferencesChanged).toHaveBeenCalledWith({ orientation: "vertical" });
  });
});

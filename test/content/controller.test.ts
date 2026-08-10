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
    return iframe;
  };
  let closeHandler: (() => void) | null = null;

  const overlay: Overlay & { calls: string[]; requestClose(): void } = {
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
    showCard: vi.fn((text: string) => void overlay.calls.push(`card:${text}`)),
    hideCard: vi.fn(),
    onRequestClose: (handler) => {
      closeHandler = handler;
    },
    destroy: vi.fn(() => void overlay.calls.push("destroy")),
    requestClose: () => closeHandler?.(),
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

function deps(overrides: Partial<ControllerDeps> = {}): ControllerDeps {
  return {
    checkAvailability: async () => "available",
    createTranslator: async () => ({ translate: async (t: string) => `[${t}]`, destroy: vi.fn() }),
    openPane: async () => paneDocument(),
    requestFramingOverride: async () => ({ kind: "no-permission" }),
    releaseFramingOverride: async () => {},
    createOverlay: () => overlay,
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

  it("records the origin, which is the only way the popup can offer an override", async () => {
    await startSplit(document, DEFAULT_PREFERENCES, hooks, blocked());

    expect(hooks.blocked).toEqual([window.location.origin]);
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

describe("orientation", () => {
  it("flips and remembers, without disturbing the ratio", async () => {
    const controller = await startSplit(document, DEFAULT_PREFERENCES, hooks, deps());

    controller.toggleOrientation();

    expect(overlay.setOrientation).toHaveBeenLastCalledWith("vertical");
    expect(hooks.onPreferencesChanged).toHaveBeenCalledWith({ orientation: "vertical" });
  });
});

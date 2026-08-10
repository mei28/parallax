// @vitest-environment jsdom
// Drag handle tests.
//
// The arithmetic lives in shared/geometry.ts and is tested there. What is tested here is the
// wiring: that a drag previews before it commits, that the destructive outcome is reversible
// until the pointer is released, and that the handle stops listening when the split ends.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createResizer } from "../../src/content/resizer.ts";
import { ATTR_DRAGGING } from "../../src/shared/constants.ts";

let container: HTMLElement;
let handle: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
  container = document.createElement("div");
  handle = document.createElement("button");
  container.append(handle);
  document.body.append(container);

  // jsdom lays nothing out, so the container has to be told how big it is.
  container.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 1008,
      height: 800,
      right: 1008,
      bottom: 800,
      x: 0,
      y: 0,
    }) as DOMRect;
  handle.setPointerCapture = vi.fn();
  handle.releasePointerCapture = vi.fn();
});

function pointer(type: string, x: number, y = 0): PointerEvent {
  return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }) as unknown as PointerEvent;
}

function mount(overrides: Partial<Parameters<typeof createResizer>[0]> = {}) {
  const onPreview = vi.fn();
  const onCommit = vi.fn();
  createResizer({
    container,
    handle,
    orientation: () => "horizontal",
    initialRatio: 0.5,
    onPreview,
    onCommit,
    signal: new AbortController().signal,
    ...overrides,
  });
  return { onPreview, onCommit };
}

describe("createResizer", () => {
  it("previews the new ratio while the pointer moves", () => {
    const { onPreview } = mount();

    handle.dispatchEvent(pointer("pointerdown", 504));
    handle.dispatchEvent(pointer("pointermove", 254));

    expect(onPreview).toHaveBeenLastCalledWith(0.25);
  });

  it("ignores movement before the drag starts", () => {
    const { onPreview } = mount();

    handle.dispatchEvent(pointer("pointermove", 254));

    expect(onPreview).not.toHaveBeenCalled();
  });

  it("marks the container while dragging, so the frames stop hit-testing the pointer", () => {
    mount();

    handle.dispatchEvent(pointer("pointerdown", 504));
    expect(container.hasAttribute(ATTR_DRAGGING)).toBe(true);

    handle.dispatchEvent(pointer("pointerup", 504));
    expect(container.hasAttribute(ATTR_DRAGGING)).toBe(false);
  });

  it("commits a plain split when the pointer is released in range", () => {
    const { onCommit } = mount();

    handle.dispatchEvent(pointer("pointerdown", 504));
    handle.dispatchEvent(pointer("pointermove", 304));
    handle.dispatchEvent(pointer("pointerup", 304));

    expect(onCommit).toHaveBeenCalledWith({ kind: "split", ratio: 0.3 });
  });

  it("commits a collapse when the pointer is released past the threshold", () => {
    const { onCommit } = mount();

    handle.dispatchEvent(pointer("pointerdown", 504));
    handle.dispatchEvent(pointer("pointermove", 20));
    handle.dispatchEvent(pointer("pointerup", 20));

    expect(onCommit).toHaveBeenCalledWith({ kind: "collapse", collapsed: "source" });
  });

  it("does not commit until the pointer is released, so the gesture stays reversible", () => {
    const { onCommit } = mount();

    handle.dispatchEvent(pointer("pointerdown", 504));
    handle.dispatchEvent(pointer("pointermove", 20));

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("previews which pane a release would remove, and clears it on the way back", () => {
    const onCollapsePreview = vi.fn();
    mount({ onCollapsePreview });

    handle.dispatchEvent(pointer("pointerdown", 504));
    handle.dispatchEvent(pointer("pointermove", 20));
    expect(onCollapsePreview).toHaveBeenLastCalledWith("source");

    handle.dispatchEvent(pointer("pointermove", 504));
    expect(onCollapsePreview).toHaveBeenLastCalledWith(null);
  });

  it("reads the vertical axis when the panes are stacked", () => {
    const { onPreview } = mount({ orientation: () => "vertical" });

    handle.dispatchEvent(pointer("pointerdown", 0, 400));
    handle.dispatchEvent(pointer("pointermove", 0, 200));

    // 800px tall, 8px handle: 196 of 792 available.
    expect(onPreview).toHaveBeenLastCalledWith(expect.closeTo(0.247, 3));
  });

  it("moves the ratio with the arrow keys", () => {
    const { onCommit } = mount();

    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    expect(onCommit).toHaveBeenCalledWith({ kind: "split", ratio: expect.closeTo(0.52, 4) });
  });

  it("steps from the ratio the split was opened at, not from the middle", () => {
    const { onCommit } = mount({ initialRatio: 0.3 });

    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    expect(onCommit).toHaveBeenCalledWith({ kind: "split", ratio: expect.closeTo(0.32, 4) });
  });

  it("keeps a pane from being removed by a key press, stopping at the threshold", () => {
    const { onCommit } = mount();

    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));

    // 120px of the 1000px available, the point at which the source pane would collapse.
    expect(onCommit).toHaveBeenCalledWith({ kind: "split", ratio: expect.closeTo(0.12, 4) });
  });

  it("stops listening once the split is torn down", () => {
    const abort = new AbortController();
    const { onPreview } = mount({ signal: abort.signal });

    abort.abort();
    handle.dispatchEvent(pointer("pointerdown", 504));
    handle.dispatchEvent(pointer("pointermove", 254));

    expect(onPreview).not.toHaveBeenCalled();
  });
});

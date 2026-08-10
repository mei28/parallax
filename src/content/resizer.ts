// The drag handle.
//
// All the arithmetic is in shared/geometry.ts, so this module is only wiring: read the
// pointer, ask geometry what it means, preview, and commit on release.
//
// Committing on release rather than during the drag is what makes removing a pane a
// reversible gesture. Dragging past the threshold shows which pane would go; dragging back
// out clears it; only lifting the pointer acts.
import {
  ATTR_COLLAPSING,
  ATTR_DRAGGING,
  COLLAPSE_THRESHOLD_PX,
  HANDLE_SIZE_PX,
} from "../shared/constants.ts";
import type { SplitGeometry, SplitOutcome } from "../shared/geometry.ts";
import { canSplit, clampRatio, evaluateRatio, positionToRatio } from "../shared/geometry.ts";
import type { Orientation, PaneId } from "../shared/types.ts";

/** How far one arrow key press moves the split. */
const KEY_STEP = 0.02;

export interface ResizerOptions {
  container: HTMLElement;
  handle: HTMLElement;
  /** Read at event time, so flipping the split direction needs no re-wiring. */
  orientation: () => Orientation;
  /** Where the split already is, so the first key press steps from there. */
  initialRatio: number;
  onPreview: (ratio: number) => void;
  onCollapsePreview?: (pane: PaneId | null) => void;
  onCommit: (outcome: SplitOutcome) => void;
  signal: AbortSignal;
}

export function createResizer(options: ResizerOptions): void {
  const { container, handle, signal } = options;
  let dragging = false;
  let ratio = options.initialRatio;

  function geometry(): SplitGeometry {
    const box = container.getBoundingClientRect();
    return {
      containerSize: options.orientation() === "horizontal" ? box.width : box.height,
      handleSize: HANDLE_SIZE_PX,
      collapseThreshold: COLLAPSE_THRESHOLD_PX,
    };
  }

  function positionOf(event: PointerEvent): number {
    const box = container.getBoundingClientRect();
    return options.orientation() === "horizontal"
      ? event.clientX - box.left
      : event.clientY - box.top;
  }

  function preview(next: number): void {
    ratio = next;
    options.onPreview(next);

    const outcome = evaluateRatio(next, geometry());
    const doomed = outcome.kind === "collapse" ? outcome.collapsed : null;
    container.toggleAttribute(ATTR_COLLAPSING, doomed !== null);
    options.onCollapsePreview?.(doomed);
  }

  handle.addEventListener(
    "pointerdown",
    (event) => {
      dragging = true;
      container.toggleAttribute(ATTR_DRAGGING, true);
      handle.setPointerCapture(event.pointerId);
    },
    { signal },
  );

  handle.addEventListener(
    "pointermove",
    (event) => {
      if (!dragging) {
        return;
      }
      preview(positionToRatio(positionOf(event), geometry()));
    },
    { signal },
  );

  for (const type of ["pointerup", "pointercancel"] as const) {
    handle.addEventListener(
      type,
      (event) => {
        if (!dragging) {
          return;
        }
        dragging = false;
        container.toggleAttribute(ATTR_DRAGGING, false);
        container.toggleAttribute(ATTR_COLLAPSING, false);
        options.onCollapsePreview?.(null);
        handle.releasePointerCapture(event.pointerId);
        options.onCommit(evaluateRatio(ratio, geometry()));
      },
      { signal },
    );
  }

  // Keyboard resizing, so the split is not a mouse-only feature. Home and End go to the
  // thresholds rather than to the edges, so a key press cannot remove a pane by surprise.
  handle.addEventListener(
    "keydown",
    (event) => {
      const horizontal = options.orientation() === "horizontal";
      const decrease = horizontal ? "ArrowLeft" : "ArrowUp";
      const increase = horizontal ? "ArrowRight" : "ArrowDown";

      const box = geometry();
      let next: number | null = null;
      if (event.key === decrease) {
        next = ratio - KEY_STEP;
      } else if (event.key === increase) {
        next = ratio + KEY_STEP;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = 1;
      }
      if (next === null) {
        return;
      }

      event.preventDefault();
      // Clamped to the range where neither pane collapses, so a held-down arrow key or a
      // press of Home cannot remove a pane. Removing one stays a deliberate drag.
      ratio = canSplit(box) ? clampRatio(next, box) : ratio;
      options.onPreview(ratio);
      options.onCommit(evaluateRatio(ratio, box));
    },
    { signal },
  );
}

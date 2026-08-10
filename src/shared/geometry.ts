// Split geometry — every number the drag handle and the collapse rule need.
//
// All lengths are pixels measured along the split axis, so the same arithmetic serves a
// left/right split and a top/bottom one. The caller decides which axis it is reading.
import { clamp } from "./num.ts";
import type { PaneId } from "./types.ts";

export interface SplitGeometry {
  /** Full extent of the container along the split axis. */
  readonly containerSize: number;
  /** Thickness of the drag handle, which belongs to neither pane. */
  readonly handleSize: number;
  /** A pane narrower than this is collapsed rather than shown. */
  readonly collapseThreshold: number;
}

export type SplitOutcome =
  | { readonly kind: "split"; readonly ratio: number }
  | { readonly kind: "collapse"; readonly collapsed: PaneId };

export interface PaneSizes {
  readonly source: number;
  readonly target: number;
}

/** Space left for the panes once the handle has taken its share. */
function availableSize(geometry: SplitGeometry): number {
  return geometry.containerSize - geometry.handleSize;
}

/**
 * Convert a pointer offset within the container into a split ratio.
 *
 * The pointer sits at the middle of the handle, so half the handle is subtracted to get
 * the source pane's extent. Values outside the container clamp to a fully collapsed pane;
 * deciding what to do about that is `evaluateRatio`'s job, not this one's.
 */
export function positionToRatio(position: number, geometry: SplitGeometry): number {
  const available = availableSize(geometry);
  return clamp((position - geometry.handleSize / 2) / available, 0, 1);
}

/** Split the available space between the two panes. */
export function paneSizes(ratio: number, geometry: SplitGeometry): PaneSizes {
  const available = availableSize(geometry);
  return { source: available * ratio, target: available * (1 - ratio) };
}

/**
 * Decide whether a ratio is a usable split or a collapse.
 *
 * A pane sitting exactly on the threshold stays open, so dragging to the boundary and
 * back is not a destructive gesture.
 */
export function evaluateRatio(ratio: number, geometry: SplitGeometry): SplitOutcome {
  const { source, target } = paneSizes(ratio, geometry);
  if (source < geometry.collapseThreshold) {
    return { kind: "collapse", collapsed: "source" };
  }
  if (target < geometry.collapseThreshold) {
    return { kind: "collapse", collapsed: "target" };
  }
  return { kind: "split", ratio };
}

/** Whether the container is wide enough to hold two panes and the handle between them. */
export function canSplit(geometry: SplitGeometry): boolean {
  return geometry.containerSize >= 2 * geometry.collapseThreshold + geometry.handleSize;
}

/**
 * Pull a ratio back inside the range where neither pane collapses.
 *
 * Precondition: `canSplit(geometry)`. Below that size there is no valid ratio to return,
 * and the caller reports WINDOW_TOO_SMALL instead of asking for one.
 */
export function clampRatio(ratio: number, geometry: SplitGeometry): number {
  const minimum = geometry.collapseThreshold / availableSize(geometry);
  return clamp(ratio, minimum, 1 - minimum);
}

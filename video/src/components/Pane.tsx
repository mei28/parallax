import { type CSSProperties, type FC, useCallback, useLayoutEffect, useRef } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ROOT_ANCHOR_ID } from "../../../src/shared/constants.ts";
import type { AnchorSample } from "../../../src/shared/scroll.ts";
import { ARTICLE, type Block, type BlockKind } from "../article";
import { CYAN, INK } from "../theme";

/** The widest the article's column gets, as on most article pages. */
const COLUMN = 760;
/** How long a block stays lit after it turns, in frames. */
const GLOW_FRAMES = 24;

const KIND_STYLE: Record<BlockKind, CSSProperties> = {
  title: { fontSize: 28.5, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 18px" },
  heading: { fontSize: 21.75, fontWeight: 700, margin: "27px 0 12px" },
  paragraph: { fontSize: 18.75, lineHeight: 1.75, margin: "0 0 15px", color: "#3c3c46" },
};

/**
 * Which blocks are in Japanese. "none" is the page as published, "done" a finished
 * translation. Otherwise block i turns at frame `start + i * stagger` of the scene, top to
 * bottom, the order the extension works through what is on screen.
 */
export type Translation = "none" | "done" | { start: number; stagger: number };

/** Frames since a block turned, "done" long since, or null while it is still English. */
type Age = number | "done" | null;

const ageOf = (translation: Translation, index: number, frame: number): Age => {
  if (translation === "none") {
    return null;
  }
  if (translation === "done") {
    return "done";
  }
  const age = frame - (translation.start + index * translation.stagger);
  return age < 0 ? null : age;
};

/** How a pane is laid out, in the terms the extension's anchor math works in. */
export type PaneLayout = {
  /** Height of the visible part of the pane. */
  viewport: number;
  /** The furthest the page can scroll. */
  maxScroll: number;
  /** Where each block sits on the page, after the root anchor for the space above them. */
  samples: AnchorSample[];
};

/** The block the reader is on, marked in both panes, and how strongly (0 to 1). */
export type Mark = { id: number; strength: number };

/** The bar beside the block being read. */
const Marker: FC<{ strength: number }> = ({ strength }) => (
  <div
    style={{
      position: "absolute",
      left: -22,
      top: 0,
      bottom: 0,
      width: 4.5,
      borderRadius: 3,
      background: CYAN,
      opacity: strength,
    }}
  />
);

/** The light and focus of a block that has just turned. */
const turningStyle = (age: number, fps: number): CSSProperties => {
  const focus = spring({ frame: age, fps, config: { damping: 200 }, durationInFrames: 10 });
  const glow = interpolate(age, [0, GLOW_FRAMES], [0.3, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const light = `rgb(34 211 238 / ${glow})`;
  return {
    opacity: interpolate(focus, [0, 1], [0.3, 1]),
    filter: `blur(${interpolate(focus, [0, 1], [4, 0])}px)`,
    borderRadius: 6,
    background: light,
    // A spread shadow in the same colour lights a margin around the block without moving
    // anything; padding would push the blocks below it down.
    boxShadow: `0 0 0 9px ${light}`,
  };
};

/**
 * One block. Its text is swapped whole, the way the extension assigns Text.data, and then
 * lit up and brought into focus so the eye catches which block just turned.
 */
const BlockView: FC<{ block: Block; age: Age; mark: number }> = ({ block, age, mark }) => {
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        ...KIND_STYLE[block.kind],
        position: "relative",
        // Once settled, a turned block is styled exactly as a finished one, so a scene
        // that starts from a finished translation picks up without a visible seam.
        ...(typeof age === "number" && age < GLOW_FRAMES ? turningStyle(age, fps) : {}),
      }}
    >
      {mark > 0 ? <Marker strength={mark} /> : null}
      {age === null ? block.en : block.ja}
    </div>
  );
};

/** The language badge in the pane's corner. */
const Tag: FC<{ japanese: boolean }> = ({ japanese }) => (
  <div
    style={{
      position: "absolute",
      top: 18,
      right: 21,
      padding: "4.5px 13.5px",
      borderRadius: 999,
      fontSize: 15.75,
      fontWeight: 640,
      letterSpacing: "0.09em",
      textTransform: "uppercase",
      color: japanese ? "#0e7490" : INK,
      background: japanese ? `${CYAN}2b` : `${INK}1f`,
    }}
  >
    {japanese ? "日本語" : "English"}
  </div>
);

/** Reads the pane's layout off the DOM. Offsets, not client rects, so scaling is ignored. */
const measure = (
  viewport: HTMLElement | null,
  page: HTMLElement | null,
  column: HTMLElement | null,
): PaneLayout => {
  if (viewport === null || page === null || column === null) {
    throw new Error("Pane was measured before it was mounted");
  }
  const blocks = Array.from(column.children, (child, id) => {
    if (!(child instanceof HTMLElement)) {
      throw new Error(`Pane block ${id} is not an HTML element`);
    }
    return { id, top: child.offsetTop, height: child.offsetHeight };
  });
  const first = blocks[0];
  if (first === undefined) {
    throw new Error("Pane has no blocks to anchor on");
  }
  return {
    viewport: viewport.clientHeight,
    maxScroll: page.offsetHeight - viewport.clientHeight,
    samples: [{ id: ROOT_ANCHOR_ID, top: 0, height: first.top }, ...blocks],
  };
};

const sameSample = (a: AnchorSample, b: AnchorSample | undefined): boolean =>
  b !== undefined && a.id === b.id && a.top === b.top && a.height === b.height;

const sameLayout = (a: PaneLayout, b: PaneLayout): boolean =>
  a.viewport === b.viewport &&
  a.maxScroll === b.maxScroll &&
  a.samples.length === b.samples.length &&
  a.samples.every((sample, i) => sameSample(sample, b.samples[i]));

type PaneProps = {
  translation: Translation;
  /** How much of the page has arrived in the pane, 0 to 1. */
  loaded: number;
  /** How far down the page is scrolled, in pixels. */
  scroll: number;
  mark: Mark | null;
  /** Receives the pane's layout whenever it changes, for a scene that scrolls by it. */
  onLayout?: (layout: PaneLayout) => void;
};

/** One of the two panes, showing the whole article in whichever language each block is in. */
export const Pane: FC<PaneProps> = ({ translation, loaded, scroll, mark, onLayout }) => {
  const frame = useCurrentFrame();
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const reportedRef = useRef<PaneLayout | null>(null);
  /** Measures the pane and, if anything has moved since last time, tells the scene. */
  const report = useCallback(() => {
    if (onLayout === undefined) {
      return;
    }
    const layout = measure(viewportRef.current, pageRef.current, columnRef.current);
    if (reportedRef.current !== null && sameLayout(reportedRef.current, layout)) {
      return;
    }
    reportedRef.current = layout;
    onLayout(layout);
  }, [onLayout]);
  // After every render, because a scene that resizes the pane changes where the text wraps
  // on every frame. A report made here re-renders the scene before the frame is painted.
  useLayoutEffect(() => {
    report();
  });
  // And on resize, because the frame is not always at its full size when the scene mounts,
  // and the frame growing re-renders nothing.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const page = pageRef.current;
    if (viewport === null || page === null) {
      throw new Error("Pane was laid out before it was mounted");
    }
    const observer = new ResizeObserver(report);
    observer.observe(viewport);
    observer.observe(page);
    return () => observer.disconnect();
  }, [report]);

  const blocks = ARTICLE.map((block, i) => ({ block, age: ageOf(translation, i, frame) }));
  const japanese = blocks.some(({ age }) => age !== null);
  return (
    // The viewport stays put and carries the badge; the page inside it, padding included, is
    // what moves when the pane scrolls.
    <div
      ref={viewportRef}
      style={{
        position: "relative",
        height: "100%",
        overflow: "hidden",
        background: japanese ? "#fafaff" : "#fff",
      }}
    >
      <div
        ref={pageRef}
        style={{
          position: "relative",
          padding: "39px 48px",
          transform: `translateY(${-scroll}px)`,
        }}
      >
        <div ref={columnRef} style={{ maxWidth: COLUMN, margin: "0 auto", opacity: loaded }}>
          {blocks.map(({ block, age }, i) => (
            <BlockView
              key={block.en}
              block={block}
              age={age}
              mark={mark?.id === i ? mark.strength : 0}
            />
          ))}
        </div>
      </div>
      {/* After the page, so text scrolling past the corner goes under the badge. */}
      <Tag japanese={japanese} />
    </div>
  );
};

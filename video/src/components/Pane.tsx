import type { CSSProperties, FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
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

/**
 * One block. Its text is swapped whole, the way the extension assigns Text.data, and then
 * lit up and brought into focus so the eye catches which block just turned.
 */
const BlockView: FC<{ block: Block; age: Age }> = ({ block, age }) => {
  const { fps } = useVideoConfig();
  const style = KIND_STYLE[block.kind];
  if (age === null) {
    return <div style={style}>{block.en}</div>;
  }
  if (age === "done") {
    return <div style={style}>{block.ja}</div>;
  }
  const focus = spring({ frame: age, fps, config: { damping: 200 }, durationInFrames: 10 });
  const glow = interpolate(age, [0, GLOW_FRAMES], [0.3, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const light = `rgb(34 211 238 / ${glow})`;
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(focus, [0, 1], [0.3, 1]),
        filter: `blur(${interpolate(focus, [0, 1], [4, 0])}px)`,
        borderRadius: 6,
        background: light,
        // A spread shadow in the same colour lights a margin around the block without
        // moving anything; padding would push the blocks below it down.
        boxShadow: `0 0 0 9px ${light}`,
      }}
    >
      {block.ja}
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

type PaneProps = {
  translation: Translation;
  /** How much of the page has arrived in the pane, 0 to 1. */
  loaded: number;
};

/** One of the two panes, showing the whole article in whichever language each block is in. */
export const Pane: FC<PaneProps> = ({ translation, loaded }) => {
  const frame = useCurrentFrame();
  const blocks = ARTICLE.map((block, i) => ({ block, age: ageOf(translation, i, frame) }));
  const japanese = blocks.some(({ age }) => age !== null);
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "39px 48px",
        background: japanese ? "#fafaff" : "#fff",
      }}
    >
      <Tag japanese={japanese} />
      <div style={{ maxWidth: COLUMN, margin: "0 auto", opacity: loaded }}>
        {blocks.map(({ block, age }) => (
          <BlockView key={block.en} block={block} age={age} />
        ))}
      </div>
    </div>
  );
};

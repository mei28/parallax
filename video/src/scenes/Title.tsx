import type { FC } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Exit } from "../components/Exit";
import { CYAN } from "../theme";

const HEADLINE = ["Read a page and its", "translation, side by side"];
/** Drawn in the accent colour, as the <em> in the listing's hero image is. */
const ACCENT = "translation";
const SUB = "One tab, two panes, kept on the same sentence as you scroll.";

/** Frames between one word starting to rise and the next. */
const STAGGER = 3;

type Word = { text: string; order: number };
type Line = { text: string; words: Word[] };

// Words are numbered straight through the headline, so the stagger runs on across the line
// break rather than restarting at it.
const LINES: Line[] = HEADLINE.map((text, row) => {
  const start = HEADLINE.slice(0, row).reduce((count, line) => count + line.split(" ").length, 0);
  const words = text.split(" ").map((word, i) => ({ text: word, order: start + i }));
  return { text, words };
});
const WORD_COUNT = LINES.reduce((count, line) => count + line.words.length, 0);

/** One headline word, rising into focus on its turn. */
const RisingWord: FC<{ word: Word }> = ({ word }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame: frame - word.order * STAGGER, fps, config: { damping: 200 } });
  const accented = word.text.startsWith(ACCENT);
  return (
    <span
      style={{
        display: "inline-block",
        opacity: rise,
        transform: `translateY(${interpolate(rise, [0, 1], [48, 0])}px)`,
        filter: `blur(${interpolate(rise, [0, 1], [12, 0])}px)`,
      }}
    >
      {accented ? (
        <>
          <span style={{ color: CYAN }}>{ACCENT}</span>
          {word.text.slice(ACCENT.length)}
        </>
      ) : (
        word.text
      )}
    </span>
  );
};

/** The listing's headline, word by word, then the line that says what it means. */
export const Title: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // The sub-line waits for the last word of the headline to be on its way.
  const sub = spring({ frame: frame - (WORD_COUNT * STAGGER + 8), fps, config: { damping: 200 } });

  return (
    <Exit>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            fontSize: 108,
            fontWeight: 660,
            letterSpacing: "-0.025em",
            lineHeight: 1.12,
          }}
        >
          {LINES.map((line) => (
            <div
              key={line.text}
              style={{ display: "flex", justifyContent: "center", columnGap: "0.26em" }}
            >
              {line.words.map((word) => (
                <RisingWord key={word.order} word={word} />
              ))}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 36,
            opacity: 0.72 * sub,
            transform: `translateY(${interpolate(sub, [0, 1], [20, 0])}px)`,
          }}
        >
          {SUB}
        </div>
      </AbsoluteFill>
    </Exit>
  );
};

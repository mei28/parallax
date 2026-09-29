import type { FC, ReactNode } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CYAN } from "../theme";
import { useExitStyle } from "./Exit";

export type Caption = {
  title: string;
  /** The part of the title drawn in the accent colour. Must appear in it. */
  accent: string;
  sub: string;
};

/** The title with its accent picked out, as the <em> in the listing images. */
const Title: FC<{ caption: Caption }> = ({ caption: { title, accent } }) => {
  const at = title.indexOf(accent);
  if (at < 0) {
    throw new Error(`Caption "${title}" does not contain its accent "${accent}"`);
  }
  return (
    <>
      {title.slice(0, at)}
      <span style={{ color: CYAN }}>{accent}</span>
      {title.slice(at + accent.length)}
    </>
  );
};

type StageProps = {
  caption: Caption;
  /**
   * Whether the window rises into frame. A scene continuing from one that already brought
   * the window up passes false, and the cut between them changes only the caption.
   */
  windowEnters: boolean;
  children: ReactNode;
};

/**
 * The listing images' layout: a caption, with a browser window under it. The caption
 * leaves at the end of the scene; the window stays, so the next scene can carry on from
 * where this one left it.
 */
export const Stage: FC<StageProps> = ({ caption, windowEnters, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExitStyle();
  const captionIn = spring({ frame, fps, config: { damping: 200 } });
  const windowIn = windowEnters ? spring({ frame: frame - 4, fps, config: { damping: 200 } }) : 1;
  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column" }}>
      {/* Each line kept to one, so every caption is the same height and the window below
          sits at the same place in every scene. */}
      <header style={{ padding: "60px 96px 0", whiteSpace: "nowrap", ...exit }}>
        <div
          style={{
            opacity: captionIn,
            transform: `translateY(${interpolate(captionIn, [0, 1], [24, 0])}px)`,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 69,
              fontWeight: 660,
              lineHeight: 1.16,
              letterSpacing: "-0.025em",
            }}
          >
            <Title caption={caption} />
          </h1>
          <p style={{ margin: "18px 0 0", fontSize: 28.5, lineHeight: 1.5, opacity: 0.72 }}>
            {caption.sub}
          </p>
        </div>
      </header>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "44px 96px 0",
          transform: `translateY(${interpolate(windowIn, [0, 1], [900, 0])}px)`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

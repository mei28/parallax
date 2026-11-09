import type { CSSProperties, FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CYAN } from "../theme";

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

/**
 * A scene's caption at the top left, as in the listing images, rising in as the scene
 * starts. How it leaves is up to the scene, through `style`.
 */
export const CaptionHeader: FC<{ caption: Caption; style?: CSSProperties }> = ({
  caption,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const captionIn = spring({ frame, fps, config: { damping: 200 } });
  return (
    // Each line kept to one, so every caption is the same height and whatever sits below it
    // is at the same place in every scene.
    <header style={{ padding: "60px 96px 0", whiteSpace: "nowrap", ...style }}>
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
  );
};

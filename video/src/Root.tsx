import type { FC } from "react";
import { Composition } from "remotion";
import { PROMO_DURATION, Promo } from "./Promo";
import { FPS } from "./timing";

/** Every <Composition> here is one entry in the Studio's sidebar and one renderable id. */
export const RemotionRoot: FC = () => (
  // The Chrome Web Store embeds the promo video from YouTube, whose player is 16:9.
  <Composition
    id="Promo"
    component={Promo}
    durationInFrames={PROMO_DURATION}
    fps={FPS}
    width={1920}
    height={1080}
  />
);

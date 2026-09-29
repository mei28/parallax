import type { FC } from "react";
import { Series } from "remotion";
import { Backdrop } from "./components/Backdrop";
import { LogoIntro } from "./scenes/LogoIntro";
import { Split } from "./scenes/Split";
import { Title } from "./scenes/Title";
import { seconds } from "./timing";

/** The storyboard: each scene in the order it plays, and for how long. */
const SCENES = [
  { name: "LogoIntro", Scene: LogoIntro, duration: seconds(3) },
  { name: "Title", Scene: Title, duration: seconds(3) },
  { name: "Split", Scene: Split, duration: seconds(7) },
];

export const PROMO_DURATION = SCENES.reduce((total, scene) => total + scene.duration, 0);

/**
 * The whole promo. The backdrop sits outside the series, so it stays put, and keeps
 * drifting, across the cuts between scenes. Each scene sends itself away, rather than
 * being wrapped here, so a scene can leave part of itself on stage for the next.
 */
export const Promo: FC = () => (
  <Backdrop>
    <Series>
      {SCENES.map(({ name, Scene, duration }) => (
        <Series.Sequence key={name} name={name} durationInFrames={duration}>
          <Scene />
        </Series.Sequence>
      ))}
    </Series>
  </Backdrop>
);

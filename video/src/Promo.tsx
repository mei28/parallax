import type { FC } from "react";
import { Series } from "remotion";
import { Backdrop } from "./components/Backdrop";
import { Exit } from "./components/Exit";
import { LogoIntro } from "./scenes/LogoIntro";
import { Title } from "./scenes/Title";
import { seconds } from "./timing";

/** The storyboard: each scene in the order it plays, and for how long. */
const SCENES = [
  { name: "LogoIntro", Scene: LogoIntro, duration: seconds(3) },
  { name: "Title", Scene: Title, duration: seconds(3) },
];

export const PROMO_DURATION = SCENES.reduce((total, scene) => total + scene.duration, 0);

/**
 * The whole promo. The backdrop sits outside the series, so it stays put, and keeps
 * drifting, across the cuts between scenes.
 */
export const Promo: FC = () => (
  <Backdrop>
    <Series>
      {SCENES.map(({ name, Scene, duration }) => (
        <Series.Sequence key={name} name={name} durationInFrames={duration}>
          <Exit>
            <Scene />
          </Exit>
        </Series.Sequence>
      ))}
    </Series>
  </Backdrop>
);

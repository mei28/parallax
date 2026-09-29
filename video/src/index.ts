// The entry point the Remotion CLI finds by default. It only registers the root; every
// video lives in Root.tsx as a <Composition>.

import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);

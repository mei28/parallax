// Read by the Remotion CLI (studio, render, still). Each option is also a CLI flag:
// https://www.remotion.dev/docs/config

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// JPEG frames encode faster than PNG, and nothing in this video needs transparency.
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

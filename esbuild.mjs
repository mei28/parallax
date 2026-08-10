// esbuild configuration for the parallax Chrome extension
import { cpSync, mkdirSync } from "node:fs";
import { build, context } from "esbuild";

const isWatch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: {
    content: "src/content/index.ts",
    background: "src/background/index.ts",
    popup: "src/popup/index.ts",
  },
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "es2022",
  // The overlay stylesheet is inlined into a closed shadow root as a string, so it never
  // becomes a separate file and needs no web_accessible_resources entry.
  loader: { ".css": "text" },
  logLevel: "info",
};

function copyStatic() {
  mkdirSync("dist", { recursive: true });
  cpSync("static", "dist", { recursive: true });
}

if (isWatch) {
  copyStatic();
  const ctx = await context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  copyStatic();
  await build(buildOptions);
}

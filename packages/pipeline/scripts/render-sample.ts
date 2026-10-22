// Renders the built-in silent sample (no API keys needed) to check templates and rendering.
// Usage: pnpm sample  → out/sample/sample.mp4 and a few still frames.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { sampleTimeline } from "../../video/src/sample";
import { repoRoot } from "../src/env";
import { chromeMode } from "../src/stages/render";

const outDir = path.join(repoRoot, "out/sample");
await mkdir(outDir, { recursive: true });

const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.join(repoRoot, "packages/video/src/index.ts") });
const inputProps = sampleTimeline as unknown as Record<string, unknown>;
const composition = await selectComposition({ serveUrl, id: "Explainer", inputProps, chromeMode });

for (const frame of sampleTimeline.scenes.map((s) => s.startFrame + 45)) {
  await renderStill({
    composition,
    serveUrl,
    inputProps,
    frame,
    chromeMode,
    scale: 0.5,
    output: path.join(outDir, `frame-${frame}.png`),
  });
}
const t1 = Date.now();
await renderMedia({
  composition,
  serveUrl,
  inputProps,
  codec: "h264",
  chromeMode,
  outputLocation: path.join(outDir, "sample.mp4"),
});
console.log(
  `stills ${((t1 - t0) / 1000).toFixed(1)}s, video ${((Date.now() - t1) / 1000).toFixed(1)}s for ${composition.durationInFrames} frames → out/sample/`,
);

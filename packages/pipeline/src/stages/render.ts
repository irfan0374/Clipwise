import path from "node:path";
import type { Timeline } from "@clipwise/video";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { repoRoot } from "../env";

const entryPoint = path.join(repoRoot, "packages/video/src/index.ts");

// The default headless shell crashes on macOS 26 (missing ICU data in child processes); Chrome for Testing works.
export const chromeMode = "chrome-for-testing" as const;

export type RenderOptions = {
  /** Called with 0–100 as frames render (default: prints every 10%). */
  onProgress?: (percent: number) => void;
  /** Also writes a JPEG thumbnail to this path (a still from the middle of a scene, never a transition). */
  thumbnailFile?: string;
};

/** Middle of the first scene after the title (or of the title scene for one-scene videos). */
export const thumbnailFrame = (timeline: Timeline) => {
  const scene = timeline.scenes[1] ?? timeline.scenes[0];
  return scene ? Math.floor((scene.startFrame + scene.endFrame) / 2) : 0;
};

const printProgress = (pct: number) => process.stdout.write(`  render ${pct}%${pct === 100 ? "\n" : "\r"}`);

/** Bundles the Remotion project with this run's media folder as its public dir, then renders the MP4. */
export const renderVideo = async (
  timeline: Timeline,
  mediaDir: string,
  outputFile: string,
  { onProgress = printProgress, thumbnailFile }: RenderOptions = {},
) => {
  const serveUrl = await bundle({ entryPoint, publicDir: mediaDir });
  const inputProps = timeline as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: "Explainer", inputProps, chromeMode });

  let lastReported = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outputFile,
    inputProps,
    chromeMode,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== lastReported) {
        lastReported = pct;
        onProgress(pct);
      }
    },
  });

  if (thumbnailFile) {
    await renderStill({
      composition,
      serveUrl,
      inputProps,
      chromeMode,
      frame: Math.min(thumbnailFrame(timeline), composition.durationInFrames - 1),
      imageFormat: "jpeg",
      jpegQuality: 80,
      scale: 0.5,
      output: thumbnailFile,
    });
  }
  return { durationInFrames: composition.durationInFrames, fps: composition.fps };
};

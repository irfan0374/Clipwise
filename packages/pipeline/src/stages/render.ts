import path from "node:path";
import type { Timeline } from "@clipwise/video";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { repoRoot } from "../env";

const entryPoint = path.join(repoRoot, "packages/video/src/index.ts");

// The default headless shell crashes on macOS 26 (missing ICU data in child processes); Chrome for Testing works.
export const chromeMode = "chrome-for-testing" as const;

/** Bundles the Remotion project with this run's media folder as its public dir, then renders the MP4. */
export const renderVideo = async (timeline: Timeline, mediaDir: string, outputFile: string) => {
  const serveUrl = await bundle({ entryPoint, publicDir: mediaDir });
  const inputProps = timeline as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: "Explainer", inputProps, chromeMode });

  let lastLogged = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outputFile,
    inputProps,
    chromeMode,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== lastLogged) {
        lastLogged = pct;
        process.stdout.write(`  render ${pct}%\r`);
      }
    },
  });
  process.stdout.write("\n");
};

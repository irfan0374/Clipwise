// The small part of the pipeline the web app uses (no Remotion, no file reads), so Next.js can bundle it.
export { autoLength, formatGuides, type VideoFormat } from "./formats";
export { BudgetExceededError, type ProviderGuards, setProviderGuards } from "./guards";
export { buildTimeline, estimateAlignment } from "./stages/align";
export { type Idea, suggestIdeas } from "./stages/ideas";

import { buildTimeline, estimateAlignment } from "./stages/align";
import type { Script } from "./types";

/**
 * The silent preview's timeline: the same scenes, animations and word-timed captions as the final video,
 * with timing estimated at 2.5 words per second (no voice yet). Pure, so it runs on the server or in a browser.
 */
export const previewTimeline = (script: Script) =>
  buildTimeline({
    script,
    alignment: estimateAlignment(script.scenes.map((s) => s.narration.trim()).join(" ")),
    audioFile: null,
    imageFiles: {},
  });

export {
  addScene,
  afterEdit,
  blankScene,
  canUseBars,
  changedForFactcheck,
  deleteScene,
  EDIT_SCENES,
  EditError,
  editScene,
  isVisualColor,
  MAX_LINE,
  MAX_NARRATION,
  MAX_TITLE,
  renameScript,
  reorderScenes,
  type ScenePatch,
  type StoredClaim,
  switchVisual,
} from "./edit";
export { readScene, rewriteScene } from "./stages/rewrite";
export { type Scene, SceneSchema, type Script, type Visual, VisualSchema } from "./types";

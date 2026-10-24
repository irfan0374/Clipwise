"use server";

// Editor and Storyboard edits. Every script change takes the version the browser last saw (optimistic locking):
// if the video changed in another tab meanwhile, the edit is refused with CONFLICT instead of overwriting it.

import { connectDb, ScriptVersion, Video } from "@clipwise/db";
import {
  addScene as addSceneTo,
  afterEdit,
  BudgetExceededError,
  changedForFactcheck,
  deleteScene as deleteSceneFrom,
  EditError,
  editScene,
  MAX_LINE,
  MAX_NARRATION,
  MAX_TITLE,
  renameScript,
  reorderScenes as reorderScenesIn,
  rewriteScene as rewriteWithAi,
  type Script,
  type StoredClaim,
  switchVisual,
  type VideoFormat,
} from "@clipwise/pipeline/web";
import {
  enqueueRecheck,
  publishVideoEvent,
  refundDaily,
  secondsUntilReset,
  takeDaily,
  userLimits,
} from "@clipwise/queue";
import { Id, type ScriptSource } from "@clipwise/shared";
import { VisualColors, VisualTypes } from "@clipwise/video";
import { z } from "zod";
import { ActionError, action } from "@/lib/action";
import { asWorkspace } from "@/lib/budget";
import type { requireUser } from "@/lib/session";
import { plainScript, scriptVersions, videoForOwner } from "@/lib/videos";

type Ctx = Awaited<ReturnType<typeof requireUser>>;
type Change = { script: Script; changed: number[]; moved?: Map<number, number>; model?: string };

const conflict = () => new ActionError("CONFLICT", "This video changed. Reload to see the latest.");

async function loadEditable(videoId: string, ctx: Ctx) {
  await connectDb();
  const video = await Video.findOne({ _id: videoId, workspaceId: ctx.workspace._id, deletedAt: null });
  if (!video?.script) throw new ActionError("NOT_FOUND", "This video doesn't exist anymore.");
  if (video.status !== "previewed")
    throw new ActionError("CONFLICT", "This video can't be edited while it's being worked on.");
  return video;
}

/**
 * Applies one edit: checks the version, computes the new script, updates the fact-check bookkeeping (edited
 * scenes wait for a re-check), saves it as a new version, and queues the re-check. Returns the fresh video.
 */
async function commit(
  ctx: Ctx,
  videoId: string,
  expectedVersion: number,
  source: ScriptSource,
  compute: (script: Script, video: Awaited<ReturnType<typeof loadEditable>>) => Promise<Change> | Change,
) {
  const video = await loadEditable(videoId, ctx);
  if (video.scriptVersion !== expectedVersion) throw conflict();
  const before = plainScript(video.script);
  let change: Change;
  try {
    change = await compute(before, video);
  } catch (error) {
    if (error instanceof EditError) throw new ActionError("VALIDATION", error.message);
    throw error;
  }
  const fc = video.factcheck;
  const { claims, pending } = afterEdit({
    claims: (fc?.claims ?? []).map((c) => ({
      scene: c.scene ?? 0,
      text: c.text ?? "",
      verdict: c.verdict ?? "unsure",
      fix: c.fix ?? "",
      acceptedAt: c.acceptedAt ?? null,
    })) as StoredClaim[],
    pending: fc?.pendingScenes ?? [],
    changed: change.changed,
    moved: change.moved,
  });
  const version = expectedVersion + 1;
  const saved = await Video.findOneAndUpdate(
    { _id: video._id, scriptVersion: expectedVersion, status: "previewed" },
    {
      $set: {
        script: change.script,
        title: change.script.title,
        scriptVersion: version,
        factcheck: {
          checkedVersion: pending.length ? (fc?.checkedVersion ?? 0) : version,
          claims,
          rewrites: fc?.rewrites ?? 0,
          numbersRemovedFromScenes: fc?.numbersRemovedFromScenes ?? [],
          pendingScenes: pending,
        },
      },
    },
  );
  if (!saved) throw conflict();
  await ScriptVersion.create({
    workspaceId: video.workspaceId,
    videoId: video._id,
    version,
    source,
    script: change.script,
    changedScenes: change.changed,
    model: change.model ?? null,
    createdByUserId: ctx.user.id,
  });
  if (pending.length) {
    // The edit is saved either way; a missed re-check shows as "Checking…" until the next edit queues one.
    await enqueueRecheck(videoId, version).catch((e) => console.error("[edit] recheck not queued", e));
  }
  await publishVideoEvent(videoId, { type: "script", scriptVersion: version }).catch(() => {});
  const fresh = await videoForOwner(videoId, ctx.workspace._id);
  if (!fresh) throw new ActionError("NOT_FOUND", "This video doesn't exist anymore.");
  return { video: fresh };
}

/** Runs a Gemini edit under the user's daily AI-edit allowance (given back if nothing was spent). */
async function withAiEdit<T>(ctx: Ctx, fn: () => Promise<T>): Promise<T> {
  if (!(await takeDaily(ctx.user.id, "edits"))) {
    throw new ActionError(
      "LIMIT_REACHED",
      `You've used today's ${userLimits().aiEditsPerDay} AI rewrites. Edit by typing, or come back tomorrow.`,
      secondsUntilReset(),
    );
  }
  try {
    return await asWorkspace({ workspaceId: ctx.workspace._id.toString(), userId: ctx.user.id }, fn);
  } catch (error) {
    if (error instanceof ActionError && error.code === "CONFLICT") throw error;
    await refundDaily(ctx.user.id, "edits");
    if (error instanceof ActionError) throw error;
    if (error instanceof BudgetExceededError || /quota/i.test(String(error))) {
      throw new ActionError("PAUSED", "AI rewrites are paused for a moment. Try again later.");
    }
    console.error("[edit] AI rewrite failed", error);
    throw new ActionError("INTERNAL", "The AI couldn't rewrite this scene. Try again.");
  }
}

const Base = { videoId: Id, expectedVersion: z.number().int().min(1) };

const Patch = z
  .object({
    narration: z.string().max(MAX_NARRATION + 50),
    onScreenText: z.array(z.string().max(MAX_LINE + 20)).max(3),
    template: z.enum(["title", "bullets", "stat"]),
    stat: z.object({ value: z.string().max(12), label: z.string().max(60) }),
    /** Switch the animation; the server builds a valid visual from the scene's text. */
    visualType: z.enum(VisualTypes),
    color: z.enum(VisualColors),
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, "Nothing to change.");

/** Text, layout or animation of one scene (autosaved from the editor). */
export const updateScene = action(
  z.object({ ...Base, sceneIndex: z.number().int().min(0), patch: Patch }),
  async ({ videoId, expectedVersion, sceneIndex, patch }, ctx) =>
    commit(ctx, videoId, expectedVersion, "user-edit", (script) => {
      const { visualType, color, ...rest } = patch;
      let next = editScene(script, sceneIndex, rest);
      if (visualType || color) {
        const scene = next.scenes[sceneIndex]!;
        const visual = switchVisual(scene, visualType ?? scene.visual?.type ?? "icon", color);
        next = editScene(next, sceneIndex, { visual });
      }
      return { script: next, changed: changedForFactcheck(script, next) };
    }),
);

/** Drag and drop. `order[i]` is the current index of the scene that goes to position i. */
export const reorderScenes = action(
  z.object({ ...Base, order: z.array(z.number().int().min(0)).min(3).max(10) }),
  async ({ videoId, expectedVersion, order }, ctx) =>
    commit(ctx, videoId, expectedVersion, "reordered", (script) => ({
      ...reorderScenesIn(script, order),
      changed: [],
    })),
);

/** Adds a blank scene, or one written by AI, after `afterIndex`. */
export const addScene = action(
  z.object({ ...Base, afterIndex: z.number().int().min(0), mode: z.enum(["blank", "ai"]) }),
  async ({ videoId, expectedVersion, afterIndex, mode }, ctx) => {
    const run = () =>
      commit(ctx, videoId, expectedVersion, "scene-added", async (script, video) => {
        const added = addSceneTo(script, afterIndex);
        if (mode === "blank") return { script: added.script, moved: added.moved, changed: [] };
        const { scene, model } = await rewriteWithAi({
          script: added.script,
          index: added.index,
          topic: video.topic,
          format: video.format as VideoFormat,
        });
        const withScene = {
          ...added.script,
          scenes: added.script.scenes.map((s, i) => (i === added.index ? scene : s)),
        };
        const fixed = editScene(withScene, added.index, {}); // re-syncs hook and CTA
        return { script: fixed, moved: added.moved, changed: [added.index], model };
      });
    return mode === "ai" ? withAiEdit(ctx, run) : run();
  },
);

export const deleteScene = action(
  z.object({ ...Base, sceneIndex: z.number().int().min(0) }),
  async ({ videoId, expectedVersion, sceneIndex }, ctx) =>
    commit(ctx, videoId, expectedVersion, "scene-deleted", (script) => ({
      ...deleteSceneFrom(script, sceneIndex),
      changed: [],
    })),
);

/** "Rewrite with AI" / the regenerate icon: a new version of one scene, then its facts are checked again. */
export const rewriteScene = action(
  z.object({ ...Base, sceneIndex: z.number().int().min(0), instruction: z.string().trim().max(200).optional() }),
  async ({ videoId, expectedVersion, sceneIndex, instruction }, ctx) =>
    withAiEdit(ctx, () =>
      commit(ctx, videoId, expectedVersion, "scene-regenerated", async (script, video) => {
        if (!script.scenes[sceneIndex]) throw new EditError("This scene doesn't exist anymore.");
        const { scene, model } = await rewriteWithAi({
          script,
          index: sceneIndex,
          topic: video.topic,
          format: video.format as VideoFormat,
          instruction,
        });
        const next = editScene(
          { ...script, scenes: script.scenes.map((s, i) => (i === sceneIndex ? scene : s)) },
          sceneIndex,
          {},
        );
        return { script: next, changed: [sceneIndex], model };
      }),
    ),
);

/** Undo, redo and the history menu: makes an earlier version the current one (as a new version). */
export const restoreVersion = action(
  z.object({ ...Base, version: z.number().int().min(1) }),
  async ({ videoId, expectedVersion, version }, ctx) =>
    commit(ctx, videoId, expectedVersion, "restored", async (script) => {
      const row = await ScriptVersion.findOne({ videoId, workspaceId: ctx.workspace._id, version }).lean();
      if (!row) throw new EditError("That version isn't available anymore.");
      const restored = plainScript(row.script);
      // Claims stay with scenes that still exist; scenes whose facts differ are checked again.
      const moved = new Map(restored.scenes.map((_, i) => [i, i] as [number, number]));
      return { script: restored, moved, changed: changedForFactcheck(script, restored) };
    }),
);

/** The pencil next to the title. Not a script version: renaming never needs a new voice or check. */
export const renameVideo = action(
  z.object({ videoId: Id, title: z.string().max(MAX_TITLE + 20) }),
  async ({ videoId, title }, ctx) => {
    await connectDb();
    const video = await Video.findOne({ _id: videoId, workspaceId: ctx.workspace._id, deletedAt: null });
    if (!video?.script) throw new ActionError("NOT_FOUND", "This video doesn't exist anymore.");
    let next: Script;
    try {
      next = renameScript(plainScript(video.script), title);
    } catch (error) {
      if (error instanceof EditError) throw new ActionError("VALIDATION", error.message);
      throw error;
    }
    await Video.updateOne({ _id: video._id }, { $set: { title: next.title, "script.title": next.title } });
    return { title: next.title };
  },
);

/** Versions for the history menu (newest first). */
export const listVersions = action(z.object({ videoId: Id }), async ({ videoId }, ctx) => ({
  versions: await scriptVersions(videoId, ctx.workspace._id),
}));

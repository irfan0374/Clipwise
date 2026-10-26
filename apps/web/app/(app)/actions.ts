"use server";

import { connectDb, Video } from "@clipwise/db";
import { BudgetExceededError, suggestIdeas } from "@clipwise/pipeline/web";
import {
  activeRunCount,
  cancelVideo as cancelRun,
  refundDaily,
  retryVideo as retryRun,
  secondsUntilReset,
  startVideo,
  takeDaily,
  userLimits,
  withWorkspaceLock,
} from "@clipwise/queue";
import { Format, Id, LengthMode, Topic, VoiceId } from "@clipwise/shared";
import type { Types } from "mongoose";
import { z } from "zod";
import { ActionError, action } from "@/lib/action";
import { asWorkspace } from "@/lib/budget";

const starting = () => new ActionError("BUSY", "Another video is starting. Try again in a moment.");

const busy = () =>
  new ActionError(
    "BUSY",
    `You already have ${userLimits().activeVideos} videos in progress. Wait for one to finish, then try again.`,
  );

/** Create screen: saves the video and queues the script. The worker does the rest; the page follows live. */
export const createVideo = action(
  z.object({ topic: Topic, format: Format, lengthMode: LengthMode, voiceId: VoiceId }),
  async (input, { user, workspace }) => {
    const allowanceAt = new Date();
    // Count running videos and start the new one under a lock, so simultaneous clicks can't all pass the limit.
    const locked = await withWorkspaceLock(workspace._id, async () => {
      if ((await activeRunCount(workspace._id)) >= userLimits().activeVideos) throw busy();
      if (!(await takeDaily(user.id, "videos", allowanceAt))) {
        throw new ActionError(
          "LIMIT_REACHED",
          `You've made ${userLimits().videosPerDay} videos today, the daily limit in the beta. Come back tomorrow.`,
          secondsUntilReset(),
        );
      }
      try {
        return await startVideo({ ...input, workspaceId: workspace._id, userId: user.id, target: "script" });
      } catch (error) {
        await refundDaily(user.id, "videos", allowanceAt);
        throw error;
      }
    });
    if (!locked) throw starting();
    return { videoId: locked.value.videoId };
  },
);

/** "Need an idea?": 4–8 ideas for a niche, from one Gemini call. */
export const brainstormIdeas = action(
  z.object({ niche: z.string().trim().min(2, "Type a niche, e.g. fitness").max(120), format: Format }),
  async ({ niche, format }, { user, workspace }) => {
    const allowanceAt = new Date();
    if (!(await takeDaily(user.id, "ai", allowanceAt))) {
      throw new ActionError(
        "LIMIT_REACHED",
        `You've used today's ${userLimits().ideasPerDay} idea suggestions. Come back tomorrow.`,
        secondsUntilReset(),
      );
    }
    try {
      const { ideas } = await asWorkspace({ workspaceId: workspace._id.toString(), userId: user.id }, () =>
        suggestIdeas(niche, format),
      );
      return { ideas };
    } catch (error) {
      await refundDaily(user.id, "ai", allowanceAt);
      if (error instanceof BudgetExceededError || /quota/i.test(String(error))) {
        throw new ActionError("PAUSED", "Idea suggestions are paused for a moment. Try again later.");
      }
      throw error;
    }
  },
);

const ownVideo = async (videoId: string, workspaceId: Types.ObjectId) => {
  await connectDb();
  const video = await Video.exists({ _id: videoId, workspaceId, deletedAt: null });
  if (!video) throw new ActionError("NOT_FOUND", "This video doesn't exist anymore.");
};

export const cancelVideo = action(z.object({ videoId: Id }), async ({ videoId }, { workspace }) => {
  await ownVideo(videoId, workspace._id);
  if (!(await cancelRun(videoId))) throw new ActionError("CONFLICT", "This video can't be stopped anymore.");
  return { status: "draft" as const };
});

export const retryVideo = action(z.object({ videoId: Id }), async ({ videoId }, { workspace }) => {
  await ownVideo(videoId, workspace._id);
  const stage = await retryRun(videoId);
  if (!stage) throw new ActionError("CONFLICT", "This video isn't waiting for a retry.");
  return { stage };
});

/** "Mark as OK" on a fact-check note: the user checked it. Notes are warnings; they never block rendering. */
export const acceptClaim = action(
  z.object({ videoId: Id, claimIndex: z.number().int().min(0).max(100) }),
  async ({ videoId, claimIndex }, { workspace }) => {
    await ownVideo(videoId, workspace._id);
    const res = await Video.updateOne(
      { _id: videoId, workspaceId: workspace._id, [`factcheck.claims.${claimIndex}`]: { $exists: true } },
      { $set: { [`factcheck.claims.${claimIndex}.acceptedAt`]: new Date() } },
    );
    if (!res.matchedCount) throw new ActionError("NOT_FOUND", "This note doesn't exist anymore.");
    const video = await Video.findById(videoId, { "factcheck.claims": 1 }).lean();
    const remaining = (video?.factcheck?.claims ?? []).filter((c) => c.verdict !== "correct" && !c.acceptedAt).length;
    return { remaining };
  },
);

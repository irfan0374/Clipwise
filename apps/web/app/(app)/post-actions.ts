"use server";
// Instagram posting from the video page: the AI caption, "Post now" and "Try again" (Step J1).
import { connectDb, Video } from "@clipwise/db";
import {
  AllowanceExceededError,
  BudgetExceededError,
  type Script,
  type VideoFormat,
  writeCaption,
} from "@clipwise/pipeline/web";
import { createPost, retryPost, secondsUntilReset, videoPosts } from "@clipwise/queue";
import { Id } from "@clipwise/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, action } from "@/lib/action";
import { asWorkspace } from "@/lib/budget";

/**
 * The caption for the "Post to Instagram" window. Opening it reuses the saved caption (no AI request);
 * "Rewrite caption" asks the AI again. Uses one of the workspace's daily AI requests.
 */
export const postCaption = action(
  z.object({ videoId: Id, rewrite: z.boolean().default(false) }),
  async ({ videoId, rewrite }, ctx) => {
    await connectDb();
    const video = await Video.findOne(
      { _id: videoId, workspaceId: ctx.workspace._id, deletedAt: null },
      { script: 1, format: 1, postCaption: 1 },
    ).lean();
    if (!video?.script) throw new ActionError("NOT_FOUND", "This video doesn't exist anymore.");
    if (!rewrite && video.postCaption) return { caption: video.postCaption };
    try {
      const { caption } = await asWorkspace({ workspaceId: ctx.workspace._id.toString(), userId: ctx.user.id }, () =>
        writeCaption(video.script as unknown as Script, (video.format ?? "explainer") as VideoFormat),
      );
      await Video.updateOne({ _id: video._id }, { $set: { postCaption: caption } });
      return { caption };
    } catch (error) {
      if (error instanceof AllowanceExceededError)
        throw new ActionError("LIMIT_REACHED", error.message, secondsUntilReset());
      if (error instanceof BudgetExceededError || /quota/i.test(String(error)))
        throw new ActionError("PAUSED", "The AI caption writer is paused for a moment. Write your own caption.");
      console.error("[post] caption failed", error);
      throw new ActionError("INTERNAL", "The AI couldn't write a caption. Write your own or try again.");
    }
  },
);

export const postToInstagram = action(
  z.object({ videoId: Id, accountId: Id, caption: z.string().max(2200) }),
  async ({ videoId, accountId, caption }, ctx) => {
    const result = await createPost({
      workspaceId: ctx.workspace._id,
      userId: ctx.user.id,
      videoId,
      accountId,
      caption,
    });
    // The caption the user actually posted becomes the saved one for next time.
    await Video.updateOne({ _id: videoId, workspaceId: ctx.workspace._id }, { $set: { postCaption: caption.trim() } });
    revalidatePath(`/videos/${videoId}`);
    return result;
  },
);

export const retryInstagramPost = action(z.object({ postId: Id }), async ({ postId }, ctx) =>
  retryPost({ workspaceId: ctx.workspace._id, postId }),
);

/** The video's posts, for live status while one is being published. */
export const listVideoPosts = action(z.object({ videoId: Id }), async ({ videoId }, ctx) => ({
  posts: await videoPosts(ctx.workspace._id, videoId),
}));

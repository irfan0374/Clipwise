"use server";
// Instagram posting: the AI caption, Post now / Schedule, Reschedule, Cancel and "Try again" (Steps J1–J2).
import { connectDb, Video } from "@clipwise/db";
import {
  AllowanceExceededError,
  BudgetExceededError,
  type Script,
  type VideoFormat,
  writeCaption,
} from "@clipwise/pipeline/web";
import {
  calendarPosts,
  cancelPost,
  createPost,
  postableVideos,
  reschedulePost,
  retryPost,
  scheduleRules,
  secondsUntilReset,
  videoPosts,
  waitingCount,
} from "@clipwise/queue";
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

const When = z.iso.datetime({ offset: true });

export const postToInstagram = action(
  z.object({ videoId: Id, accountId: Id, caption: z.string().max(2200), publishAt: When.optional() }),
  async ({ videoId, accountId, caption, publishAt }, ctx) => {
    const result = await createPost({
      workspaceId: ctx.workspace._id,
      userId: ctx.user.id,
      videoId,
      accountId,
      caption,
      publishAt: publishAt ? new Date(publishAt) : undefined,
    });
    // The caption the user actually posted becomes the saved one for next time.
    await Video.updateOne({ _id: videoId, workspaceId: ctx.workspace._id }, { $set: { postCaption: caption.trim() } });
    revalidatePath(`/videos/${videoId}`);
    revalidatePath("/calendar");
    return result;
  },
);

export const rescheduleInstagramPost = action(z.object({ postId: Id, publishAt: When }), async (input, ctx) => {
  const result = await reschedulePost({
    workspaceId: ctx.workspace._id,
    postId: input.postId,
    publishAt: new Date(input.publishAt),
  });
  revalidatePath("/calendar");
  return result;
});

export const cancelInstagramPost = action(z.object({ postId: Id }), async ({ postId }, ctx) => {
  const result = await cancelPost({ workspaceId: ctx.workspace._id, postId });
  revalidatePath("/calendar");
  return result;
});

/** The Calendar's posts between two times (the browser asks for its own month, in its own time zone). */
export const listCalendarPosts = action(z.object({ from: When, to: When }), async ({ from, to }, ctx) => {
  const start = new Date(from);
  const end = new Date(to);
  if (end.getTime() - start.getTime() > 46 * 86_400_000 || end <= start)
    throw new ActionError("VALIDATION", "Choose one month at a time.");
  return {
    posts: await calendarPosts(ctx.workspace._id, start, end),
    waiting: await waitingCount(ctx.workspace._id),
    maxWaiting: scheduleRules.maxWaiting,
  };
});

/** Finished videos for "Schedule a video". */
export const listPostableVideos = action(z.object({}), async (_input, ctx) => ({
  videos: await postableVideos(ctx.workspace._id),
}));

export const retryInstagramPost = action(z.object({ postId: Id }), async ({ postId }, ctx) =>
  retryPost({ workspaceId: ctx.workspace._id, postId }),
);

/** The video's posts, for live status while one is being published. */
export const listVideoPosts = action(z.object({ videoId: Id }), async ({ videoId }, ctx) => ({
  posts: await videoPosts(ctx.workspace._id, videoId),
}));

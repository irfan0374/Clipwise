import { assertWorkspaceActive, connectDb, Render, SocialAccount, SocialPost, Video } from "@clipwise/db";
import type { Types } from "mongoose";
import { FinalError } from "./finals";
import { refundDaily, takeDaily, userLimits } from "./limits";
import { enqueue } from "./queues";

// Instagram posts: the web app creates a SocialPost and queues a publish job; the worker uploads and publishes it
// (apps/worker/src/jobs/publish.ts). Step J1 posts now; Step J2 adds a later publishAt (a delayed job).

type Id = Types.ObjectId | string;

/** The newest finished final MP4 of a video (what gets posted). */
export const postableRender = (videoId: Id) =>
  Render.findOne({ videoId, kind: "final", status: "done", r2Key: { $ne: null }, deletedAt: null }).sort({
    createdAt: -1,
  });

export async function createPost(input: {
  workspaceId: Id;
  userId: string;
  videoId: string;
  accountId: string;
  caption: string;
  publishAt?: Date;
}) {
  await connectDb();
  await assertWorkspaceActive(input.workspaceId);
  const video = await Video.findOne(
    { _id: input.videoId, workspaceId: input.workspaceId, deletedAt: null },
    { _id: 1 },
  );
  if (!video) throw new FinalError("NOT_FOUND", "This video doesn't exist anymore.");
  const videoId = video._id as Types.ObjectId;
  const render = await postableRender(videoId);
  if (!render) throw new FinalError("CONFLICT", "Render the video first, then post it.");
  const account = await SocialAccount.findOne({ _id: input.accountId, workspaceId: input.workspaceId });
  if (!account) throw new FinalError("NOT_FOUND", "That Instagram account isn't connected anymore.");
  if (account.status !== "connected")
    throw new FinalError("CONFLICT", `Reconnect @${account.username} in Settings → Connections first.`);

  const at = new Date();
  if (!(await takeDaily(input.userId, "posts", at)))
    throw new FinalError(
      "LIMIT_REACHED",
      `You've posted ${userLimits().postsPerDay} times today. Posting opens again at midnight UTC.`,
    );
  try {
    const post = await SocialPost.create({
      workspaceId: input.workspaceId as Types.ObjectId,
      videoId,
      renderId: render._id,
      accountId: account._id,
      username: account.username,
      caption: input.caption.trim(),
      publishAt: input.publishAt ?? at,
      createdByUserId: input.userId,
    });
    const delay = Math.max(0, post.publishAt.getTime() - Date.now());
    await enqueue("publish", { postId: post._id.toString(), attempt: 1 }, { delay });
    return { postId: post._id.toString() };
  } catch (error) {
    await refundDaily(input.userId, "posts", at);
    throw error;
  }
}

/** "Try again" on a failed post: same caption and account, a new publish job. */
export async function retryPost(input: { workspaceId: Id; postId: string }) {
  await connectDb();
  await assertWorkspaceActive(input.workspaceId);
  const post = await SocialPost.findOneAndUpdate(
    { _id: input.postId, workspaceId: input.workspaceId, status: "failed" },
    { $set: { status: "queued", error: null, publishAt: new Date() }, $inc: { attempt: 1 } },
    { returnDocument: "after" },
  );
  if (!post) throw new FinalError("CONFLICT", "This post isn't waiting for a retry.");
  const account = await SocialAccount.findOne({ _id: post.accountId, workspaceId: input.workspaceId }, { status: 1 });
  if (account?.status !== "connected") {
    await SocialPost.updateOne(
      { _id: post._id },
      { $set: { status: "failed", error: "Reconnect the Instagram account in Settings → Connections first." } },
    );
    throw new FinalError("CONFLICT", "Reconnect the Instagram account in Settings → Connections first.");
  }
  await enqueue("publish", { postId: post._id.toString(), attempt: post.attempt });
  return { postId: post._id.toString() };
}

/** A video's Instagram posts, newest first (no access keys). */
export async function videoPosts(workspaceId: Id, videoId: string) {
  await connectDb();
  const posts = await SocialPost.find({ workspaceId, videoId }).sort({ createdAt: -1 }).limit(20).lean();
  return posts.map((p) => ({
    id: p._id.toString(),
    username: p.username,
    status: p.status ?? "queued",
    publishAt: p.publishAt.toISOString(),
    postedAt: p.postedAt?.toISOString() ?? null,
    postedLate: Boolean(p.postedLate),
    permalink: p.permalink ?? null,
    error: p.error ?? null,
  }));
}
export type VideoPost = Awaited<ReturnType<typeof videoPosts>>[number];

import { assertWorkspaceActive, connectDb, Render, SocialAccount, SocialPost, Video } from "@clipwise/db";
import { storage } from "@clipwise/storage";
import type { Types } from "mongoose";
import { FinalError } from "./finals";
import { refundDaily, takeDaily, userLimits } from "./limits";
import { enqueue, removeJob } from "./queues";

// Instagram posts: the web app creates a SocialPost and queues a publish job; the worker uploads and publishes it
// (apps/worker/src/jobs/publish.ts). A scheduled post is the same job with a delay: BullMQ keeps it in Redis, so it
// survives restarts, and runs late (marked "Posted late") if the worker was off at its time.

type Id = Types.ObjectId | string;

/** How far ahead posts can be scheduled, and how many may wait at once per workspace. */
export const scheduleRules = {
  minLeadMs: 5 * 60_000,
  maxDays: 60,
  maxWaiting: Number(process.env.LIMIT_SCHEDULED_POSTS ?? 50),
};

/** Refuses a time that is too soon or too far ahead. */
function checkPublishAt(publishAt: Date, now = new Date()) {
  if (Number.isNaN(publishAt.getTime())) throw new FinalError("VALIDATION", "Choose a date and time.");
  if (publishAt.getTime() < now.getTime() + scheduleRules.minLeadMs - 30_000)
    throw new FinalError("VALIDATION", "Choose a time at least 5 minutes from now.");
  if (publishAt.getTime() > now.getTime() + scheduleRules.maxDays * 86_400_000)
    throw new FinalError("VALIDATION", `Posts can be scheduled up to ${scheduleRules.maxDays} days ahead.`);
}

/** Scheduled posts still waiting for their time. */
export const waitingCount = (workspaceId: Id) =>
  SocialPost.countDocuments({ workspaceId, status: "queued", publishAt: { $gt: new Date() } });

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
  if (input.publishAt) checkPublishAt(input.publishAt);
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
  if (input.publishAt && (await waitingCount(input.workspaceId)) >= scheduleRules.maxWaiting)
    throw new FinalError(
      "LIMIT_REACHED",
      `${scheduleRules.maxWaiting} posts are already scheduled. Wait for some to go out or cancel one.`,
    );

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
    return { postId: post._id.toString(), publishAt: post.publishAt.toISOString() };
  } catch (error) {
    await refundDaily(input.userId, "posts", at);
    throw error;
  }
}

/**
 * Moves a scheduled post. The attempt number goes up, so the old waiting job (removed here, or found later by the
 * worker) no longer matches the post and stops without posting: a moved post can never go out twice.
 */
export async function reschedulePost(input: { workspaceId: Id; postId: string; publishAt: Date }) {
  await connectDb();
  await assertWorkspaceActive(input.workspaceId);
  checkPublishAt(input.publishAt);
  const post = await SocialPost.findOneAndUpdate(
    { _id: input.postId, workspaceId: input.workspaceId, status: "queued" },
    { $set: { publishAt: input.publishAt }, $inc: { attempt: 1 } },
    { returnDocument: "after" },
  );
  if (!post) throw new FinalError("CONFLICT", "This post isn't scheduled anymore.");
  const postId = post._id.toString();
  await removeJob("publish", { postId, attempt: post.attempt - 1 });
  await enqueue(
    "publish",
    { postId, attempt: post.attempt },
    { delay: Math.max(0, input.publishAt.getTime() - Date.now()) },
  );
  return { postId, publishAt: post.publishAt.toISOString() };
}

/** Cancels a post that hasn't started publishing. */
export async function cancelPost(input: { workspaceId: Id; postId: string }) {
  await connectDb();
  await assertWorkspaceActive(input.workspaceId);
  const post = await SocialPost.findOneAndUpdate(
    { _id: input.postId, workspaceId: input.workspaceId, status: "queued" },
    { $set: { status: "cancelled" } },
    { returnDocument: "after" },
  );
  if (!post) throw new FinalError("CONFLICT", "This post is already being published or is finished.");
  await removeJob("publish", { postId: post._id.toString(), attempt: post.attempt });
  return { postId: post._id.toString() };
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
  const posts = await SocialPost.find({ workspaceId, videoId, status: { $ne: "cancelled" } })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
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

/** Signed thumbnail links, one per file (the same render is often posted more than once). */
async function thumbnails(keys: (string | null | undefined)[]) {
  const store = storage();
  const urls = new Map<string, string>();
  for (const key of new Set(keys.filter((k): k is string => Boolean(k)))) urls.set(key, await store.signedUrl(key));
  return urls;
}

/** Posts whose time falls in [from, to), with what the Calendar shows. Cancelled posts are left out. */
export async function calendarPosts(workspaceId: Id, from: Date, to: Date) {
  await connectDb();
  const posts = await SocialPost.find({
    workspaceId,
    status: { $ne: "cancelled" },
    publishAt: { $gte: from, $lt: to },
  })
    .sort({ publishAt: 1 })
    .limit(500)
    .lean();
  const videos = await Video.find({ _id: { $in: posts.map((p) => p.videoId) } }, { title: 1 }).lean();
  const renders = await Render.find(
    { _id: { $in: posts.map((p) => p.renderId) } },
    { thumbnailKey: 1, durationMs: 1 },
  ).lean();
  const title = new Map(videos.map((v) => [v._id.toString(), v.title ?? "Untitled video"]));
  const render = new Map(renders.map((r) => [r._id.toString(), r]));
  const urls = await thumbnails(renders.map((r) => r.thumbnailKey));
  return posts.map((p) => {
    const r = render.get(p.renderId.toString());
    return {
      id: p._id.toString(),
      videoId: p.videoId.toString(),
      title: title.get(p.videoId.toString()) ?? "Deleted video",
      thumbnailUrl: r?.thumbnailKey ? (urls.get(r.thumbnailKey) ?? null) : null,
      durationMs: r?.durationMs ?? 0,
      accountId: p.accountId.toString(),
      username: p.username,
      status: p.status ?? "queued",
      publishAt: p.publishAt.toISOString(),
      postedAt: p.postedAt?.toISOString() ?? null,
      postedLate: Boolean(p.postedLate),
      permalink: p.permalink ?? null,
      error: p.error ?? null,
    };
  });
}
export type CalendarPost = Awaited<ReturnType<typeof calendarPosts>>[number];

/** Finished videos that can be posted, newest first: what "Schedule a video" offers. */
export async function postableVideos(workspaceId: Id, limit = 40) {
  await connectDb();
  const finals = await Render.find(
    { workspaceId, kind: "final", status: "done", r2Key: { $ne: null }, deletedAt: null },
    { videoId: 1, thumbnailKey: 1, durationMs: 1, createdAt: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(limit * 3)
    .lean();
  const latest = new Map<string, (typeof finals)[number]>();
  for (const r of finals) if (!latest.has(r.videoId.toString())) latest.set(r.videoId.toString(), r);
  const videos = await Video.find(
    { _id: { $in: [...latest.keys()] }, workspaceId, deletedAt: null },
    { title: 1 },
  ).lean();
  const title = new Map(videos.map((v) => [v._id.toString(), v.title ?? "Untitled video"]));
  const rows = [...latest.values()].filter((r) => title.has(r.videoId.toString())).slice(0, limit);
  const urls = await thumbnails(rows.map((r) => r.thumbnailKey));
  return rows.map((r) => ({
    id: r.videoId.toString(),
    title: title.get(r.videoId.toString()) ?? "Untitled video",
    durationMs: r.durationMs ?? 0,
    thumbnailUrl: r.thumbnailKey ? (urls.get(r.thumbnailKey) ?? null) : null,
  }));
}
export type PostableVideo = Awaited<ReturnType<typeof postableVideos>>[number];

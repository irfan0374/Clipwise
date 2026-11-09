import {
  assertWorkspaceActive,
  decryptSecret,
  Render,
  SocialAccount,
  SocialPost,
  UsageEvent,
  WorkspaceAccessError,
} from "@clipwise/db";
import {
  containerStatus,
  createReelContainer,
  InstagramError,
  type JobData,
  latestMedia,
  mediaPermalink,
  publishContainer,
} from "@clipwise/queue";
import { storage } from "@clipwise/storage";
import { type Job, UnrecoverableError } from "bullmq";
import { reportJobFailure } from "../monitoring";

// Posts one Reel: Instagram downloads the final MP4 from a signed R2 link, processes it, then we publish it.
// Every step is saved on the SocialPost, so a retried job continues where the last one stopped and never posts twice.

const pollMs = () => Number(process.env.PUBLISH_POLL_MS ?? 5000);
const maxWaitMs = () => Number(process.env.PUBLISH_MAX_WAIT_MS ?? 10 * 60_000);
/** A post that goes out this much after its time was missed while the worker was offline. */
const LATE_MS = 15 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A failure that won't get better by retrying (shown to the user as is). */
class PublishFailure extends Error {}

export async function publishJob(job: Job, data: JobData<"publish">, fetcher: typeof fetch = fetch) {
  const post = await SocialPost.findById(data.postId);
  // Gone, already done, cancelled, or superseded by a newer "Try again".
  if (!post || post.status === "posted" || post.status === "cancelled" || post.attempt !== data.attempt) return;
  const attempt = job.attemptsMade + 1;
  try {
    await assertWorkspaceActive(post.workspaceId);
    const account = await SocialAccount.findOne({ _id: post.accountId, workspaceId: post.workspaceId }).select(
      "+tokenEnc",
    );
    if (!account) throw new PublishFailure("The Instagram account was disconnected.");
    if (account.status !== "connected")
      throw new PublishFailure(`Reconnect @${account.username} in Settings → Connections, then try again.`);
    const token = decryptSecret(account.tokenEnc);

    await SocialPost.updateOne({ _id: post._id }, { $set: { status: "publishing", error: null } });

    let containerId = post.containerId;
    if (!containerId) {
      const render = await Render.findOne({ _id: post.renderId, status: "done", deletedAt: null });
      if (!render?.r2Key) throw new PublishFailure("The video file is missing. Render it again, then post.");
      if (storage().driver !== "s3")
        throw new PublishFailure("Instagram can only fetch videos stored online (R2). Post from staging or live.");
      // One hour is plenty: Instagram fetches the file within a minute or two of the request.
      const videoUrl = await storage().signedUrl(render.r2Key, { expiresIn: 3600 });
      containerId = await createReelContainer(account.externalId, token, { videoUrl, caption: post.caption }, fetcher);
      await SocialPost.updateOne({ _id: post._id }, { $set: { containerId } });
    }

    // Wait for Instagram to process the video (usually under a minute for a 30–60s Reel).
    const started = Date.now();
    let status = await containerStatus(containerId, token, fetcher);
    while (status.code === "IN_PROGRESS" && Date.now() - started < maxWaitMs()) {
      await job.updateProgress(Math.min(90, Math.round(((Date.now() - started) / maxWaitMs()) * 100)));
      await sleep(pollMs());
      status = await containerStatus(containerId, token, fetcher);
    }

    let media: { id: string; permalink: string | null } | null = null;
    if (status.code === "FINISHED") {
      const id = await publishContainer(account.externalId, containerId, token, fetcher);
      media = { id, permalink: await mediaPermalink(id, token, fetcher) };
    } else if (status.code === "PUBLISHED") {
      // An earlier attempt published it but stopped before saving: find the post instead of posting again.
      media = (await latestMedia(account.externalId, token, fetcher)) ?? { id: "", permalink: null };
    } else if (status.code === "EXPIRED") {
      await SocialPost.updateOne({ _id: post._id }, { $set: { containerId: null } });
      throw new InstagramError("Instagram's upload expired. Trying again.", "temporary");
    } else if (status.code === "ERROR") {
      console.error(`[publish] post ${post._id}: Instagram couldn't process the video: ${status.detail}`);
      // A failed container can't be published; "Try again" uploads afresh.
      await SocialPost.updateOne({ _id: post._id }, { $set: { containerId: null } });
      throw new PublishFailure("Instagram couldn't process the video.");
    } else {
      throw new InstagramError("Instagram is still processing the video. Trying again.", "temporary");
    }

    const postedAt = new Date();
    await SocialPost.updateOne(
      { _id: post._id },
      {
        $set: {
          status: "posted",
          mediaId: media.id || null,
          permalink: media.permalink,
          postedAt,
          postedLate: postedAt.getTime() - post.publishAt.getTime() > LATE_MS,
          error: null,
        },
      },
    );
    await UsageEvent.create({
      workspaceId: post.workspaceId,
      userId: post.createdByUserId,
      videoId: post.videoId,
      provider: "instagram",
      operation: "publish",
      quantity: 1,
      unit: "requests",
    });
    console.log(
      `[publish] posted ${post._id} to @${account.username}${media.permalink ? ` · ${media.permalink}` : ""}`,
    );
  } catch (error) {
    const auth = error instanceof InstagramError && error.kind === "auth";
    const retry = error instanceof InstagramError && error.kind === "temporary" && attempt < (job.opts.attempts ?? 1);
    console.error(
      `[publish] post ${post._id} failed (attempt ${attempt}): ${error instanceof InstagramError ? (error.detail ?? error.message) : (error as Error).message}`,
    );
    if (retry) throw error; // BullMQ retries with backoff; the post stays "publishing"
    if (auth)
      await SocialAccount.updateOne(
        { _id: post.accountId },
        { $set: { status: "reconnect", statusReason: "Instagram access stopped working." } },
      );
    const message =
      error instanceof PublishFailure || error instanceof InstagramError
        ? error.message
        : error instanceof WorkspaceAccessError
          ? "This workspace is suspended."
          : "Posting failed. Try again.";
    await SocialPost.updateOne({ _id: post._id }, { $set: { status: "failed", error: message } });
    if (!(error instanceof PublishFailure) && !(error instanceof WorkspaceAccessError))
      reportJobFailure(error, { name: "publish", videoId: post.videoId.toString(), attempt, code: "PUBLISH" });
    throw new UnrecoverableError(message);
  }
}

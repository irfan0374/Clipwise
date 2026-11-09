import { randomBytes } from "node:crypto";
import { encryptSecret, Render, SocialAccount, SocialPost, UsageEvent, Video, Workspace } from "@clipwise/db";
import { cancelPost, createPost, queue, reschedulePost, retryPost, scheduleRules } from "@clipwise/queue";
import type { Job } from "bullmq";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { makeProcessor } from "../src/processor";

// Instagram can only fetch videos stored online, so these tests stand in an "s3" storage that signs a fake link.
vi.mock("@clipwise/storage", async (original) => ({
  ...(await original<typeof import("@clipwise/storage")>()),
  storage: () => ({ driver: "s3", signedUrl: async (key: string) => `https://r2.test/${key}?sig=1` }),
}));

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.META_GRAPH_VERSION = "v27.0";
  process.env.PUBLISH_POLL_MS = "1";
});

type Route = [number, unknown] | ((body: URLSearchParams) => [number, unknown]);
/** A fake Graph API: answers by method + path; records every call (with the POST body). */
const fakeInstagram = (routes: Record<string, Route | Route[]>) => {
  const calls: { method: string; path: string; url: string; body: URLSearchParams }[] = [];
  const counts: Record<string, number> = {};
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/v[\d.]+\//, "");
    const body = new URLSearchParams(init?.body ? String(init.body) : url.search);
    calls.push({ method, path, url: String(input), body });
    const key = `${method} ${path}`;
    const route = routes[key];
    const step = Array.isArray(route) && Array.isArray(route[0]) ? (route as Route[]) : null;
    counts[key] = (counts[key] ?? 0) + 1;
    const n = counts[key];
    const pick = step ? step[Math.min(n, step.length) - 1] : (route as Route | undefined);
    const [status, json] = !pick
      ? [404, { error: { message: `no route ${key}`, code: 803 } }]
      : typeof pick === "function"
        ? pick(body)
        : pick;
    return new Response(JSON.stringify(json), { status });
  }) as typeof fetch;
  return { fetcher, calls };
};

const happy = {
  "POST 1784/media": [200, { id: "c1" }],
  "GET c1": [
    [200, { status_code: "IN_PROGRESS" }],
    [200, { status_code: "FINISHED" }],
  ],
  "POST 1784/media_publish": [200, { id: "m1" }],
  "GET m1": [200, { permalink: "https://www.instagram.com/reel/abc/" }],
} satisfies Record<string, Route | Route[]>;

async function setup(opts: { status?: "connected" | "reconnect"; render?: boolean } = {}) {
  const ws = await Workspace.create({ ownerUserId: "u1", name: "Test" });
  const video = await Video.create({
    workspaceId: ws._id,
    createdByUserId: "u1",
    topic: "Why is the sky blue?",
    lengthMode: "30",
    voiceId: "TX3LPaxmHKxFdv7VOQHJ",
    status: "rendered",
  });
  if (opts.render !== false)
    await Render.create({
      workspaceId: ws._id,
      videoId: video._id,
      kind: "final",
      scriptVersion: 1,
      status: "done",
      r2Key: "renders/v1/final.mp4",
    });
  const account = await SocialAccount.create({
    workspaceId: ws._id,
    platform: "instagram",
    externalId: "1784",
    username: "brand",
    tokenEnc: encryptSecret("SUAT-secret"),
    status: opts.status ?? "connected",
    connectedByUserId: "u1",
  });
  const input = {
    workspaceId: ws._id,
    userId: "u1",
    videoId: video._id.toString(),
    accountId: account._id.toString(),
    caption: "Why is the sky blue? #science",
  };
  return { ws, video, account, input };
}

/** Runs every waiting or delayed publish job once, like the worker. */
async function drainPublish(fetcher: typeof fetch) {
  const processor = makeProcessor(undefined, fetcher);
  for (let round = 0; round < 5; round++) {
    const jobs = (await queue("publish").getJobs(["waiting", "delayed"])) as Job[];
    if (!jobs.length) return;
    for (const job of jobs) {
      await processor(job).catch(() => {});
      await job.remove();
    }
  }
}

describe("posting to Instagram", () => {
  it("uploads the final MP4 from a signed link, waits for Instagram, publishes and saves the link", async () => {
    const { input, video } = await setup();
    const { postId } = await createPost(input);
    expect(await queue("publish").count()).toBe(1);
    const ig = fakeInstagram(happy);
    await drainPublish(ig.fetcher);

    const post = await SocialPost.findById(postId).lean();
    expect(post).toMatchObject({
      status: "posted",
      containerId: "c1",
      mediaId: "m1",
      permalink: "https://www.instagram.com/reel/abc/",
      postedLate: false,
      error: null,
    });
    const upload = ig.calls.find((c) => c.method === "POST" && c.path === "1784/media");
    expect(Object.fromEntries(upload?.body ?? [])).toMatchObject({
      media_type: "REELS",
      video_url: "https://r2.test/renders/v1/final.mp4?sig=1",
      caption: "Why is the sky blue? #science",
      access_token: "SUAT-secret",
    });
    // The access key only travels in POST bodies, never in a POST URL.
    expect(ig.calls.filter((c) => c.method === "POST").every((c) => !c.url.includes("SUAT"))).toBe(true);
    expect(await UsageEvent.countDocuments({ videoId: video._id, provider: "instagram", operation: "publish" })).toBe(
      1,
    );
  });

  it("keeps the upload when Instagram is busy and continues with it on the retry (never two uploads)", async () => {
    const { input } = await setup();
    const { postId } = await createPost(input);
    const ig = fakeInstagram({
      ...happy,
      "GET c1": [
        [503, { error: { message: "busy", code: 2 } }],
        [200, { status_code: "FINISHED" }],
      ],
    });
    const processor = makeProcessor(undefined, ig.fetcher);
    const [job] = (await queue("publish").getJobs(["waiting"])) as Job[];
    await expect(processor(job!)).rejects.toThrow(/busy/);
    expect((await SocialPost.findById(postId).lean())?.status).toBe("publishing");
    await processor({ ...job!, attemptsMade: 1 } as Job);
    expect((await SocialPost.findById(postId).lean())?.status).toBe("posted");
    expect(ig.calls.filter((c) => c.method === "POST" && c.path === "1784/media")).toHaveLength(1);
  });

  it("finds the post instead of publishing twice when an earlier attempt already published", async () => {
    const { input } = await setup();
    const { postId } = await createPost(input);
    await SocialPost.updateOne({ _id: postId }, { $set: { containerId: "c1" } });
    const ig = fakeInstagram({
      "GET c1": [200, { status_code: "PUBLISHED" }],
      "GET 1784/media": [200, { data: [{ id: "m9", permalink: "https://www.instagram.com/reel/xyz/" }] }],
    });
    await drainPublish(ig.fetcher);
    expect(await SocialPost.findById(postId).lean()).toMatchObject({ status: "posted", mediaId: "m9" });
    expect(ig.calls.some((c) => c.path.endsWith("media_publish"))).toBe(false);
  });

  it("marks the account 'Reconnect needed' when Instagram access stopped working, without retrying", async () => {
    const { input, account } = await setup();
    const { postId } = await createPost(input);
    const ig = fakeInstagram({ "POST 1784/media": [400, { error: { message: "Session expired", code: 190 } }] });
    await drainPublish(ig.fetcher);
    expect(await SocialPost.findById(postId).lean()).toMatchObject({
      status: "failed",
      error: "Instagram access stopped working. Connect the account again.",
    });
    expect((await SocialAccount.findById(account._id).lean())?.status).toBe("reconnect");
    expect(ig.calls.filter((c) => c.path === "1784/media")).toHaveLength(1);
    await expect(retryPost({ workspaceId: input.workspaceId, postId })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("explains a video Instagram couldn't process, and 'Try again' uploads it afresh", async () => {
    const { input } = await setup();
    const { postId } = await createPost(input);
    const failing = fakeInstagram({
      ...happy,
      "GET c1": [200, { status_code: "ERROR", status: "Error: video too short" }],
    });
    await drainPublish(failing.fetcher);
    expect(await SocialPost.findById(postId).lean()).toMatchObject({
      status: "failed",
      containerId: null,
      error: "Instagram couldn't process the video.",
    });

    await retryPost({ workspaceId: input.workspaceId, postId });
    const ok = fakeInstagram({
      ...happy,
      "POST 1784/media": [200, { id: "c2" }],
      "GET c2": [200, { status_code: "FINISHED" }],
    });
    await drainPublish(ok.fetcher);
    expect(await SocialPost.findById(postId).lean()).toMatchObject({ status: "posted", attempt: 2, containerId: "c2" });
  });

  it("refuses to post without a finished render or with an account that needs reconnecting", async () => {
    const noRender = await setup({ render: false });
    await expect(createPost(noRender.input)).rejects.toMatchObject({ code: "CONFLICT" });
    await Workspace.deleteMany({});
    await SocialAccount.deleteMany({});
    const stale = await setup({ status: "reconnect" });
    await expect(createPost(stale.input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await SocialPost.countDocuments()).toBe(0);
    expect(await queue("publish").count()).toBe(0);
  });

  it("allows 10 posts per user per day", async () => {
    const { input } = await setup();
    for (let i = 0; i < 10; i++) await createPost(input);
    await expect(createPost(input)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    expect(await SocialPost.countDocuments()).toBe(10);
  });

  it("marks a post that went out long after its time as posted late (worker was offline)", async () => {
    const { input } = await setup();
    const { postId } = await createPost(input);
    await SocialPost.updateOne({ _id: postId }, { $set: { publishAt: new Date(Date.now() - 60 * 60_000) } });
    await drainPublish(fakeInstagram(happy).fetcher);
    expect(await SocialPost.findById(postId).lean()).toMatchObject({ status: "posted", postedLate: true });
  });
});

describe("scheduling Instagram posts", () => {
  const inHours = (h: number) => new Date(Date.now() + h * 3600_000);
  const publishCalls = (ig: ReturnType<typeof fakeInstagram>) =>
    ig.calls.filter((c) => c.method === "POST" && c.path.endsWith("media_publish")).length;

  it("waits as a delayed job until its time", async () => {
    const { input } = await setup();
    const publishAt = inHours(3);
    const { postId } = await createPost({ ...input, publishAt });
    const [job] = (await queue("publish").getJobs(["delayed"])) as Job[];
    expect(job?.id).toBe(`post_${postId}_a1`);
    expect(job?.opts.delay ?? 0).toBeGreaterThan(3 * 3600_000 - 60_000);
    expect(await SocialPost.findById(postId).lean()).toMatchObject({ status: "queued", publishAt });
  });

  it("refuses a time that is too soon or too far ahead", async () => {
    const { input } = await setup();
    await expect(createPost({ ...input, publishAt: new Date(Date.now() + 60_000) })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(createPost({ ...input, publishAt: inHours(61 * 24) })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await SocialPost.countDocuments()).toBe(0);
  });

  it("moves a scheduled post: the old job is dropped and the post goes out once", async () => {
    const { input } = await setup();
    const { postId } = await createPost({ ...input, publishAt: inHours(3) });
    const later = inHours(30);
    await reschedulePost({ workspaceId: input.workspaceId, postId, publishAt: later });
    const jobs = (await queue("publish").getJobs(["delayed"])) as Job[];
    expect(jobs.map((j) => j.id)).toEqual([`post_${postId}_a2`]);
    expect(await SocialPost.findById(postId).lean()).toMatchObject({ status: "queued", attempt: 2, publishAt: later });

    const ig = fakeInstagram(happy);
    await drainPublish(ig.fetcher);
    expect(publishCalls(ig)).toBe(1);
    expect(await SocialPost.findById(postId).lean()).toMatchObject({ status: "posted" });
  });

  it("an old job left behind by a move stops without posting", async () => {
    const { input } = await setup();
    const { postId } = await createPost({ ...input, publishAt: inHours(3) });
    // As if the old job couldn't be removed (a worker held it): the post has moved on to attempt 2.
    await SocialPost.updateOne({ _id: postId }, { $set: { attempt: 2 } });
    const ig = fakeInstagram(happy);
    await drainPublish(ig.fetcher);
    expect(ig.calls).toHaveLength(0);
    expect(await SocialPost.findById(postId).lean()).toMatchObject({ status: "queued" });
  });

  it("cancels a scheduled post, and a cancelled post is never published", async () => {
    const { input } = await setup();
    const { postId } = await createPost({ ...input, publishAt: inHours(3) });
    await cancelPost({ workspaceId: input.workspaceId, postId });
    expect(await queue("publish").count()).toBe(0);
    expect(await SocialPost.findById(postId).lean()).toMatchObject({ status: "cancelled" });
    await expect(cancelPost({ workspaceId: input.workspaceId, postId })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      reschedulePost({ workspaceId: input.workspaceId, postId, publishAt: inHours(5) }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // A job that slipped through (cancelled after the worker fetched it) still stops at the claim.
    const second = await createPost({ ...input, publishAt: inHours(3) });
    await SocialPost.updateOne({ _id: second.postId }, { $set: { status: "cancelled" } });
    const ig = fakeInstagram(happy);
    await drainPublish(ig.fetcher);
    expect(ig.calls).toHaveLength(0);
  });

  it("can't move or cancel a post once it is publishing, or another workspace's post", async () => {
    const { input } = await setup();
    const { postId } = await createPost({ ...input, publishAt: inHours(3) });
    await SocialPost.updateOne({ _id: postId }, { $set: { status: "publishing" } });
    await expect(cancelPost({ workspaceId: input.workspaceId, postId })).rejects.toMatchObject({ code: "CONFLICT" });
    await SocialPost.updateOne({ _id: postId }, { $set: { status: "queued" } });
    const other = await Workspace.create({ ownerUserId: "u2", name: "Other" });
    await expect(cancelPost({ workspaceId: other._id, postId })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it(`keeps at most ${scheduleRules.maxWaiting} posts waiting per workspace`, async () => {
    const { input, video, account } = await setup();
    const render = await Render.findOne({ videoId: video._id });
    await SocialPost.insertMany(
      Array.from({ length: scheduleRules.maxWaiting }, () => ({
        workspaceId: input.workspaceId,
        videoId: video._id,
        renderId: render!._id,
        accountId: account._id,
        username: "brand",
        publishAt: inHours(10),
        createdByUserId: "u1",
      })),
    );
    await expect(createPost({ ...input, publishAt: inHours(3) })).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    // Posting now is still allowed.
    await expect(createPost(input)).resolves.toMatchObject({ postId: expect.any(String) });
  });
});

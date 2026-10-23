import { PipelineRun, Render, ScriptVersion, UsageEvent, Video, Workspace } from "@clipwise/db";
import { type FactCheck, type Providers, providerGuards } from "@clipwise/pipeline";
import {
  activeRunCount,
  budgetKeys,
  cancelVideo,
  enqueue,
  queue,
  rebuildBudgetCounters,
  redis,
  reserveGeminiRequest,
  retryVideo,
  startVideo,
  subscribeVideoEvents,
  takeDaily,
  withWorkspaceLock,
} from "@clipwise/queue";
import type { RunTarget, VideoEvent } from "@clipwise/shared";
import type { Job } from "bullmq";
import { describe, expect, it } from "vitest";
import { narrationText } from "../../../packages/pipeline/src/stages/voice";
import { fakeAlignment, validScript as fixtureScript } from "../../../packages/pipeline/test/fixtures";
import { makeProcessor } from "../src/processor";

/** The pipeline fixture without its photo scene: the worker plans no photos (no stock-photo provider). */
const validScript = () => {
  const s = fixtureScript();
  s.scenes[1] = {
    index: 1,
    template: "bullets",
    narration: s.scenes[1]!.narration,
    onScreenText: ["Light hits air"],
    visual: { type: "icon", icon: "sun" },
  };
  return s;
};

const check = (claims: FactCheck["claims"] = []): FactCheck => ({ claims, model: "fake", searched: false, tokens: 40 });

/** Fake AI: each call takes the next queued answer, and goes through the budget guards like a real request. */
const fakes = (
  opts: { scripts?: unknown[]; checks?: FactCheck[]; voiceSeconds?: number[]; failVoiceAfter?: number } = {},
): Providers => {
  const scripts = [...(opts.scripts ?? [validScript()])];
  const checks = [...(opts.checks ?? [check([{ scene: 1, text: "Light scatters", verdict: "correct", fix: "" }])])];
  const seconds = [...(opts.voiceSeconds ?? [30])];
  return {
    generateScript: async () => {
      await providerGuards().beforeGeminiRequest?.();
      return { raw: scripts.shift() ?? validScript(), tokens: 500, attempts: 1, model: "fake-gemini" };
    },
    factCheck: async () => {
      await providerGuards().beforeGeminiRequest?.();
      return checks.shift() ?? check();
    },
    generateVoice: async (text) => {
      const credits = Math.ceil(text.length * 0.5);
      await providerGuards().reserveVoiceCredits?.(credits);
      await providerGuards().onVoiceTake?.({ credits, characters: text.length, model: "eleven_flash_v2_5" });
      return {
        audio: Buffer.from("mp3"),
        alignment: fakeAlignment(text, (seconds.shift() ?? 30) / text.length),
        characters: text.length,
        model: "eleven_flash_v2_5",
        attempts: 1,
      };
    },
  };
};

/** Runs every waiting job in a queue through the processor (like the worker does), until none are left. */
async function drain(name: "ai" | "voice" | "render", providers: Providers) {
  const processor = makeProcessor(providers);
  const ran: string[] = [];
  for (let i = 0; i < 10; i++) {
    const jobs = (await queue(name).getJobs(["waiting"])) as Job[];
    if (!jobs.length) break;
    for (const job of jobs) {
      ran.push(job.name);
      await processor(job).catch(() => {});
      await job.remove();
    }
  }
  return ran;
}

async function newVideo(target: RunTarget = "script", lengthMode: "30" | "60" | "auto" = "30") {
  const ws = await Workspace.findOneAndUpdate(
    { ownerUserId: "u1" },
    { $setOnInsert: { ownerUserId: "u1", name: "Test" } },
    { upsert: true, returnDocument: "after" },
  );
  return startVideo({
    workspaceId: ws._id,
    userId: "u1",
    topic: "Why is the sky blue?",
    format: "explainer",
    lengthMode,
    voiceId: "TX3LPaxmHKxFdv7VOQHJ",
    target,
  });
}

describe("script → fact-check", () => {
  it("writes version 1, checks it, and stops at 'previewed' for a script-only run", async () => {
    const events: VideoEvent[] = [];
    const { videoId } = await newVideo("script");
    const stop = await subscribeVideoEvents(videoId, (e) => events.push(e));

    expect(await drain("ai", fakes())).toEqual(["script", "factcheck"]);
    await new Promise((r) => setTimeout(r, 50));
    await stop();

    const video = await Video.findById(videoId).lean();
    expect(video).toMatchObject({
      status: "previewed",
      progress: 100,
      scriptVersion: 1,
      lengthSeconds: 30,
      title: "Why is the sky blue?",
    });
    expect(video?.factcheck?.claims).toHaveLength(1);
    expect(await ScriptVersion.countDocuments({ videoId })).toBe(1);
    const run = await PipelineRun.findOne({ videoId }).lean();
    expect(run?.status).toBe("ok");
    expect(run?.stages.map((s) => `${s.stage}:${s.status}`)).toEqual(["script:ok", "factcheck:ok"]);
    const usage = await UsageEvent.find({ videoId }).lean();
    expect(usage.map((u) => `${u.operation}:${u.unit}:${u.quantity}`)).toEqual(
      expect.arrayContaining(["script:tokens:500", "request:requests:1", "factcheck:tokens:40"]),
    );
    expect(Number(await redis().get(budgetKeys.geminiRequests()))).toBe(2);
    expect(usage.filter((u) => u.unit === "requests")).toHaveLength(2); // one row per reserved request
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["status", "step", "script", "claims", "done"]));
  });

  it("saves a fact-check rewrite as version 2", async () => {
    const fixed = validScript();
    fixed.scenes[2]!.stat = { value: "~5x", label: "more blue (checked)" };
    const { videoId } = await newVideo("script");
    await drain(
      "ai",
      fakes({
        scripts: [validScript(), fixed],
        checks: [check([{ scene: 2, text: "10x more blue", verdict: "wrong", fix: "about 5x" }]), check()],
      }),
    );
    const video = await Video.findById(videoId).lean();
    expect(video?.scriptVersion).toBe(2);
    expect(video?.factcheck?.checkedVersion).toBe(2);
    const v2 = await ScriptVersion.findOne({ videoId, version: 2 }).lean();
    expect(v2?.source).toBe("factcheck-rewrite");
    expect(v2?.changedScenes).toEqual([2]);
  });

  it("queues a preview render, or voice first for a final video", async () => {
    await newVideo("preview");
    await drain("ai", fakes());
    expect((await queue("render").getJobs(["waiting"])).map((j) => j.data.kind)).toEqual(["preview"]);
    expect(await queue("voice").count()).toBe(0);

    await redis().flushdb();
    await newVideo("final");
    await drain("ai", fakes());
    expect(await queue("voice").count()).toBe(1);
  });
});

describe("voice", () => {
  it("records the voice, saves files under the script version and queues the final render", async () => {
    const { videoId } = await newVideo("final");
    await drain("ai", fakes());
    expect(await drain("voice", fakes())).toEqual(["voice"]);
    const video = await Video.findById(videoId).lean();
    expect(video?.voice).toMatchObject({
      scriptVersion: 1,
      voiceId: "TX3LPaxmHKxFdv7VOQHJ",
      model: "eleven_flash_v2_5",
    });
    expect(video?.files?.voiceKey).toMatch(/\/v1\/voice\.mp3$/);
    expect((await queue("render").getJobs(["waiting"])).map((j) => j.data.kind)).toEqual(["final"]);
    const credits = await UsageEvent.findOne({ videoId, provider: "elevenlabs", unit: "credits" }).lean();
    expect(Number(await redis().get(budgetKeys.elevenLabsCredits()))).toBe(credits?.quantity);
  });

  it("refuses to record when the month's credits would run out, without retrying", async () => {
    const { videoId } = await newVideo("final");
    await drain("ai", fakes());
    await redis().set(budgetKeys.elevenLabsCredits(), 9_990);
    await drain("voice", fakes());
    expect(Number(await redis().get(budgetKeys.elevenLabsCredits()))).toBe(9_990); // nothing reserved
    const video = await Video.findById(videoId).lean();
    expect(video?.status).toBe("failed");
    expect(video?.error).toMatchObject({
      stage: "voice",
      code: "PAUSED",
      message: "Generation is paused for a moment. Try again later.",
    });
    expect(await UsageEvent.countDocuments({ videoId, provider: "elevenlabs" })).toBe(0);
  });
});

describe("safety", () => {
  it("stops before calling Gemini when the daily budget is used up", async () => {
    await redis().set(budgetKeys.geminiRequests(), 80);
    const { videoId } = await newVideo();
    await drain("ai", fakes());
    const video = await Video.findById(videoId).lean();
    expect(video?.error?.code).toBe("PAUSED");
    expect(await UsageEvent.countDocuments({ videoId })).toBe(0);
    expect((await PipelineRun.findOne({ videoId }).lean())?.status).toBe("failed");
  });

  it("checks the budget for every Gemini request, so a fact-check can't run past it", async () => {
    await redis().set(budgetKeys.geminiRequests(), 79); // room for the script request only
    const { videoId } = await newVideo();
    await drain("ai", fakes());
    const video = await Video.findById(videoId).lean();
    expect(video).toMatchObject({ status: "failed", stage: "factcheck", error: { code: "PAUSED" } });
    expect(video?.scriptVersion).toBe(1);
    expect(Number(await redis().get(budgetKeys.geminiRequests()))).toBe(80);
  });

  it("lets only one of two simultaneous requests take the last unit of budget", async () => {
    await redis().set(budgetKeys.geminiRequests(), 79);
    const results = await Promise.all(Array.from({ length: 5 }, () => reserveGeminiRequest()));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(Number(await redis().get(budgetKeys.geminiRequests()))).toBe(80);
  });

  it("reserves credits for a speed re-take too, and keeps the record of the take already paid for", async () => {
    const { videoId } = await newVideo("final");
    await drain("ai", fakes());
    const take = Math.ceil(narrationText(validScript()).length * 0.5);
    await redis().set(budgetKeys.elevenLabsCredits(), 10_000 - take - 1); // room for exactly one take
    await drain("voice", fakes({ voiceSeconds: [34.5, 30] })); // off length → a second take is needed
    const video = await Video.findById(videoId).lean();
    expect(video).toMatchObject({ status: "failed", stage: "voice", error: { code: "PAUSED" } });
    const paid = await UsageEvent.find({ videoId, provider: "elevenlabs", unit: "credits" }).lean();
    expect(paid.map((u) => u.quantity)).toEqual([take]); // first take recorded even though the job failed
    expect(Number(await redis().get(budgetKeys.elevenLabsCredits()))).toBe(10_000 - 1);
  });

  it("finishes a render that was saved but whose video wasn't updated (crash between writes)", async () => {
    const { videoId, runId } = await newVideo("preview");
    await drain("ai", fakes());
    const job = (await queue("render").getJobs(["waiting"]))[0]!;
    const video = await Video.findById(videoId);
    await Render.updateOne(
      { _id: job.data.renderId },
      { $set: { status: "done", r2Key: "x.mp4", thumbnailKey: "x.jpg" } },
    );
    await Video.updateOne({ _id: videoId }, { $set: { status: "rendering", stage: "render" } });
    await drain("render", fakes());
    const after = await Video.findById(videoId).lean();
    expect(after).toMatchObject({ status: "previewed", stage: null, progress: 100 });
    expect(String(after?.previewRenderId)).toBe(job.data.renderId);
    expect((await PipelineRun.findById(runId).lean())?.status).toBe("ok");
    expect(video?.scriptVersion).toBe(1);
  });

  it("adds the same job only once (double clicks, retried parents)", async () => {
    const { videoId, runId } = await newVideo();
    await enqueue("script", { videoId, runId });
    await enqueue("script", { videoId, runId });
    expect(await queue("ai").count()).toBe(1);
  });

  it("ignores a fact-check job for a script version that is no longer current", async () => {
    const { videoId, runId } = await newVideo();
    await drain("ai", fakes());
    await Video.updateOne({ _id: videoId }, { $set: { scriptVersion: 5, "factcheck.checkedVersion": 1 } });
    await enqueue("factcheck", { videoId, runId, scriptVersion: 1 });
    const checks: string[] = [];
    const spy = {
      ...fakes(),
      factCheck: async () => {
        checks.push("called");
        return check();
      },
    };
    await drain("ai", spy);
    expect(checks).toEqual([]);
  });

  it("does nothing for a deleted video", async () => {
    const { videoId } = await newVideo();
    await Video.updateOne({ _id: videoId }, { $set: { deletedAt: new Date() } });
    await drain("ai", fakes());
    expect((await Video.findById(videoId).lean())?.status).toBe("draft");
  });
});

describe("cancel and retry", () => {
  it("cancels a video that is still being written: waiting jobs are dropped and nothing is saved", async () => {
    const { videoId, runId } = await newVideo();
    expect(await activeRunCount((await Video.findById(videoId))!.workspaceId)).toBe(1);
    expect(await cancelVideo(videoId)).toBe(true);
    expect(await queue("ai").count()).toBe(0);
    expect((await PipelineRun.findById(runId).lean())?.status).toBe("cancelled");
    // A job that was already running when Cancel was clicked: its result is discarded.
    await enqueue("script", { videoId, runId });
    await drain("ai", fakes());
    const video = await Video.findById(videoId).lean();
    expect(video).toMatchObject({ status: "draft", scriptVersion: 0 });
    expect(await activeRunCount(video!.workspaceId)).toBe(0);
  });

  it("can't cancel once the script is checked", async () => {
    const { videoId } = await newVideo();
    await drain("ai", fakes());
    expect(await cancelVideo(videoId)).toBe(false);
  });

  it("retries from the failed step and reuses what was done", async () => {
    await redis().set(budgetKeys.geminiRequests(), 79); // script fits, fact-check doesn't
    const { videoId } = await newVideo();
    await drain("ai", fakes());
    expect((await Video.findById(videoId).lean())?.status).toBe("failed");

    await redis().set(budgetKeys.geminiRequests(), 0); // budget back (next day)
    expect(await retryVideo(videoId)).toBe("factcheck");
    const scriptCalls: string[] = [];
    const p = fakes();
    await drain("ai", {
      ...p,
      generateScript: async (...args) => {
        scriptCalls.push("script");
        return p.generateScript(...args);
      },
    });
    const video = await Video.findById(videoId).lean();
    expect(video).toMatchObject({ status: "previewed", scriptVersion: 1, error: null });
    expect(scriptCalls).toEqual([]); // the script was reused, not rewritten
    expect(await PipelineRun.countDocuments({ videoId })).toBe(2);
  });

  it("does nothing for a video that hasn't failed", async () => {
    const { videoId } = await newVideo();
    expect(await retryVideo(videoId)).toBeNull();
  });
});

describe("per-user limits", () => {
  it("allows 10 new videos a day, then refuses without counting further", async () => {
    const results = [];
    for (let i = 0; i < 12; i++) results.push(await takeDaily("u1", "videos"));
    expect(results.filter(Boolean)).toHaveLength(10);
    expect(await takeDaily("u2", "videos")).toBe(true); // per user
  });
});

describe("review fixes", () => {
  it("a provider error that arrives after Cancel doesn't overwrite the cancellation", async () => {
    const { videoId, runId } = await newVideo();
    const p = fakes();
    await drain("ai", {
      ...p,
      generateScript: async () => {
        await cancelVideo(videoId); // user cancels while Gemini is still answering…
        throw new Error("boom"); // …and the call then fails for good
      },
    });
    for (let i = 0; i < 3; i++) await drain("ai", p); // retries are skipped: the run is cancelled
    expect((await PipelineRun.findById(runId).lean())?.status).toBe("cancelled");
    expect((await Video.findById(videoId).lean())?.status).toBe("draft");
  });

  it("retrying a failed voice step really runs again (new job id, not the retained failed one)", async () => {
    const { videoId } = await newVideo("final");
    await drain("ai", fakes());
    await redis().set(budgetKeys.elevenLabsCredits(), 10_000); // no credits left → voice fails
    await drain("voice", fakes());
    expect((await Video.findById(videoId).lean())?.status).toBe("failed");
    await redis().set(budgetKeys.elevenLabsCredits(), 0);
    expect(await retryVideo(videoId)).toBe("voice");
    expect(await drain("voice", fakes())).toEqual(["voice"]);
    expect((await Video.findById(videoId).lean())?.voice?.scriptVersion).toBe(1);
  });

  it("worker startup never overwrites live budget counters (only restores missing ones)", async () => {
    await newVideo();
    await drain("ai", fakes()); // 2 Gemini requests recorded in MongoDB
    await redis().set(budgetKeys.geminiRequests(), 50); // includes reservations still in flight
    await rebuildBudgetCounters();
    expect(Number(await redis().get(budgetKeys.geminiRequests()))).toBe(50);
    await redis().del(budgetKeys.geminiRequests()); // Redis lost its data
    const r = await rebuildBudgetCounters();
    expect(r.restored.gemini).toBe(true);
    expect(Number(await redis().get(budgetKeys.geminiRequests()))).toBe(2);
  });

  it("only one of several simultaneous starts holds the workspace lock", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        withWorkspaceLock("ws1", () => new Promise((r) => setTimeout(() => r("ok"), 50))),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await withWorkspaceLock("ws1", async () => "again")).toEqual({ value: "again" }); // released after
  });
});

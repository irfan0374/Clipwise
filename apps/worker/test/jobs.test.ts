import { PipelineRun, Render, ScriptVersion, UsageEvent, Video, Workspace } from "@clipwise/db";
import { type FactCheck, type Providers, providerGuards } from "@clipwise/pipeline";
import {
  activeRunCount,
  beatWorker,
  budgetKeys,
  budgetStatus,
  bullPrefix,
  cancelVideo,
  closeSubscriptions,
  enqueue,
  enqueueRecheck,
  nsKey,
  publishVideoEvent,
  queue,
  rebuildBudgetCounters,
  redis,
  refundDaily,
  reserveGeminiRequest,
  retryVideo,
  setGenerationPaused,
  startFinal,
  startVideo,
  stopWorkerBeat,
  subscribeVideoEvents,
  takeDaily,
  voiceIsCurrent,
  weeklyFinalCount,
  weekWindow,
  withWorkspaceLock,
  workerStatus,
} from "@clipwise/queue";
import type { RunTarget, VideoEvent } from "@clipwise/shared";
import { storage } from "@clipwise/storage";
import type { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";
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

  it("worker startup raises a counter that's below what MongoDB recorded, never lowers it", async () => {
    await newVideo();
    await drain("ai", fakes()); // 2 Gemini requests recorded in MongoDB
    await redis().set(budgetKeys.geminiRequests(), 1); // e.g. the web app reserved before the worker restored
    const r = await rebuildBudgetCounters();
    expect(r.restored.gemini).toBe(true);
    expect(Number(await redis().get(budgetKeys.geminiRequests()))).toBe(2);
  });

  it("counts every environment's part of a shared provider budget", async () => {
    const live = budgetKeys.geminiRequests(new Date(), "live");
    await redis().set(live, 79); // live used 79 of the 80 shared Gemini requests
    expect(await reserveGeminiRequest()).toBe(true); // this environment takes the last one
    expect(await reserveGeminiRequest()).toBe(false);
    expect(Number(await redis().get(live))).toBe(79); // only this environment's own part grows
    expect(Number(await redis().get(budgetKeys.geminiRequests()))).toBe(1);
    expect((await budgetStatus()).gemini.used).toBe(80);
    await redis().del(live);
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

describe("fact re-check after an edit", () => {
  /** A checked video whose scene 1 was then edited by the user (as the web edit actions save it). */
  async function editedVideo() {
    const { videoId } = await newVideo("script");
    await drain("ai", fakes());
    const script = validScript();
    script.scenes[1]!.narration = "Edited words about light.";
    await Video.updateOne(
      { _id: videoId },
      { $set: { script, scriptVersion: 2, "factcheck.claims": [], "factcheck.pendingScenes": [1] } },
    );
    await enqueueRecheck(videoId, 2);
    return videoId;
  }

  /** Runs the queued (delayed) re-checks now; `lastAttempt` makes a failure final. */
  async function runRechecks(providers: Providers, lastAttempt = false) {
    const processor = makeProcessor(providers);
    const jobs = (await queue("ai").getJobs(["delayed", "waiting"])) as Job[];
    for (const job of jobs) {
      if (lastAttempt) job.attemptsMade = (job.opts.attempts ?? 1) - 1;
      await processor(job).catch(() => {});
      await job.remove();
    }
    return jobs.map((j) => j.id);
  }

  it("checks only the edited scenes, after a short delay, and marks the version checked", async () => {
    const videoId = await editedVideo();
    const delayed = await queue("ai").getJobs(["delayed"]);
    expect(delayed.map((j) => j.id)).toEqual([`vid_${videoId}_recheck_v2`]);

    const seen: unknown[] = [];
    const providers = fakes({
      checks: [
        check([
          { scene: 1, text: "Light bends", verdict: "wrong", fix: "Light scatters" },
          { scene: 3, text: "Not shown", verdict: "wrong", fix: "" },
        ]),
      ],
    });
    const factCheck = providers.factCheck;
    providers.factCheck = async (script, opts) => {
      seen.push(script.scenes.map((s) => s.index));
      return factCheck(script, opts);
    };
    await runRechecks(providers);

    expect(seen).toEqual([[1]]); // only the edited scene is sent
    const video = await Video.findById(videoId).lean();
    expect(video?.factcheck?.pendingScenes).toEqual([]);
    expect(video?.factcheck?.checkedVersion).toBe(2);
    // Only claims about the re-checked scene are kept.
    expect(video?.factcheck?.claims.map((c) => [c.scene, c.verdict])).toEqual([[1, "wrong"]]);
    expect(video?.status).toBe("previewed");
    expect(await PipelineRun.countDocuments({ videoId, trigger: "recheck", status: "ok" })).toBe(1);
  });

  it("stops before calling Gemini when the script changed again", async () => {
    const videoId = await editedVideo();
    await Video.updateOne({ _id: videoId }, { $set: { scriptVersion: 3 } });
    const before = Number(await redis().get(budgetKeys.geminiRequests()));
    await runRechecks(fakes());
    expect(Number(await redis().get(budgetKeys.geminiRequests()))).toBe(before);
    const video = await Video.findById(videoId).lean();
    expect(video?.factcheck?.pendingScenes).toEqual([1]);
    expect(await PipelineRun.countDocuments({ videoId, trigger: "recheck" })).toBe(0);
  });

  it("never fails the video: a scene that couldn't be checked gets a note to review", async () => {
    const videoId = await editedVideo();
    const providers = fakes();
    providers.factCheck = async () => {
      throw new Error("Gemini is down");
    };
    await runRechecks(providers, true);
    const video = await Video.findById(videoId).lean();
    expect(video?.status).toBe("previewed");
    expect(video?.factcheck?.pendingScenes).toEqual([]);
    expect(video?.factcheck?.claims.map((c) => [c.scene, c.verdict])).toEqual([[1, "unsure"]]);
  });
});

describe("final rendering from the approved script", () => {
  async function ready() {
    const { videoId } = await newVideo("script");
    await drain("ai", fakes());
    const video = await Video.findById(videoId);
    return { videoId, workspaceId: video!.workspaceId, expectedVersion: video!.scriptVersion };
  }
  it("deduplicates repeated starts and queues only one voice request", async () => {
    const input = await ready();
    const first = await startFinal(input);
    const second = await startFinal(input);
    expect(first.startsWithVoice).toBe(true);
    expect(second.renderId).toBe(first.renderId);
    expect(await Render.countDocuments({ videoId: input.videoId, kind: "final" })).toBe(1);
    expect(await queue("voice").count()).toBe(1);
    expect(await PipelineRun.countDocuments({ videoId: input.videoId, trigger: "render" })).toBe(1);
  });
  it("refuses stale versions and requests from another workspace before making jobs", async () => {
    const input = await ready();
    await expect(startFinal({ ...input, expectedVersion: 99 })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(startFinal({ ...input, workspaceId: "000000000000000000000001" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await queue("voice").count()).toBe(0);
  });
  it("reuses matching voice and alignment, but not a different voice", async () => {
    const input = await ready();
    await Video.updateOne(
      { _id: input.videoId },
      {
        $set: {
          voice: { scriptVersion: 1, voiceId: "TX3LPaxmHKxFdv7VOQHJ" },
          "files.voiceKey": "voice.mp3",
          "files.alignmentKey": "alignment.json",
        },
      },
    );
    await storage().put("voice.mp3", "fixture audio");
    await storage().put("alignment.json", "{}");
    const result = await startFinal(input);
    expect(result.startsWithVoice).toBe(false);
    expect(await queue("voice").count()).toBe(0);
    expect(await queue("render").count()).toBe(1);
    const video = (await Video.findById(input.videoId))!;
    expect(voiceIsCurrent(video)).toBe(true);
    video.voiceId = "another-voice";
    expect(voiceIsCurrent(video)).toBe(false);
    video.voiceId = "TX3LPaxmHKxFdv7VOQHJ";
    video.files!.alignmentKey = null;
    expect(voiceIsCurrent(video)).toBe(false);
  });
  it("regenerates a missing completed file instead of returning a broken download", async () => {
    const input = await ready();
    const old = await Render.create({
      workspaceId: input.workspaceId,
      videoId: input.videoId,
      scriptVersion: input.expectedVersion,
      kind: "final",
      status: "done",
      r2Key: "missing-final.mp4",
    });
    await Video.updateOne({ _id: input.videoId }, { $set: { status: "rendered", finalRenderId: old._id } });
    const result = await startFinal(input);
    expect(result.reused).toBe(false);
    expect(result.renderId).not.toBe(old._id.toString());
    expect((await Render.findById(old._id))?.status).toBe("failed");
  });
  it("doesn't reuse voice metadata whose stored files are missing", async () => {
    const input = await ready();
    await Video.updateOne(
      { _id: input.videoId },
      {
        $set: {
          voice: { scriptVersion: 1, voiceId: "TX3LPaxmHKxFdv7VOQHJ" },
          "files.voiceKey": "missing-voice.mp3",
          "files.alignmentKey": "missing-alignment.json",
        },
      },
    );
    expect((await startFinal(input)).startsWithVoice).toBe(true);
    expect(await queue("voice").count()).toBe(1);
  });
  it("enforces the internal weekly ceiling without queuing or changing the project", async () => {
    const input = await ready();
    await Render.create(
      [1, 2].map((n) => ({
        workspaceId: input.workspaceId,
        videoId: input.videoId,
        scriptVersion: n + 3,
        kind: "final" as const,
        status: "done" as const,
      })),
    );
    await expect(startFinal(input)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    expect((await Video.findById(input.videoId))?.status).toBe("previewed");
    expect(await queue("voice").count()).toBe(0);
  });
  it("retries the saved final script without rewriting it even when edit re-checks are pending", async () => {
    const input = await ready();
    await Video.updateOne(
      { _id: input.videoId },
      { $set: { "factcheck.checkedVersion": 0, "factcheck.pendingScenes": [1] } },
    );
    await startFinal(input);
    await redis().set(budgetKeys.elevenLabsCredits(), 10000);
    await drain("voice", fakes());
    expect((await Video.findById(input.videoId))?.status).toBe("failed");
    await redis().set(budgetKeys.elevenLabsCredits(), 0);
    // A completed edit re-check may be newer than the failed final run.
    await PipelineRun.create({
      workspaceId: input.workspaceId,
      videoId: input.videoId,
      trigger: "recheck",
      target: "script",
      status: "ok",
    });
    expect(await retryVideo(input.videoId)).toBe("voice");
    await drain("voice", fakes());
    expect((await Video.findById(input.videoId))?.scriptVersion).toBe(input.expectedVersion);
    expect(await queue("ai").count()).toBe(0);
  });
});

describe("Step G allowance and suspension enforcement", () => {
  it("blocks a suspended workspace before queueing or charging", async () => {
    const { videoId } = await newVideo();
    const video = (await Video.findById(videoId))!;
    await Workspace.updateOne({ _id: video.workspaceId }, { $set: { suspendedAt: new Date() } });
    await expect(newVideo()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await drain("ai", fakes());
    expect(await UsageEvent.countDocuments()).toBe(0);
    expect(await redis().get(budgetKeys.geminiRequests())).toBeNull();
    expect((await Video.findById(videoId))?.error?.code).toBe("FORBIDDEN");
    await expect(retryVideo(videoId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("blocks queued voice work after suspension without reserving credits", async () => {
    const { videoId } = await newVideo("final");
    await drain("ai", fakes());
    const video = (await Video.findById(videoId))!;
    await Workspace.updateOne({ _id: video.workspaceId }, { $set: { suspendedAt: new Date() } });
    await drain("voice", fakes());
    expect(await UsageEvent.countDocuments({ provider: "elevenlabs" })).toBe(0);
    expect(await redis().get(budgetKeys.elevenLabsCredits())).toBeNull();
  });
  it("pauses and resumes queue admission without consuming provider budget", async () => {
    await setGenerationPaused(true, "all");
    await expect(newVideo()).rejects.toMatchObject({ code: "PAUSED" });
    expect(await Video.countDocuments()).toBe(0);
    await setGenerationPaused(false, "all");
    await newVideo();
    expect(await Video.countDocuments()).toBe(1);
    expect(await UsageEvent.countDocuments()).toBe(0);
  });
  it("refunds the original UTC day after midnight and never makes a counter negative", async () => {
    const before = new Date("2026-10-25T23:59:59Z"),
      after = new Date("2026-10-26T00:00:01Z");
    await takeDaily("u1", "videos", before);
    await takeDaily("u1", "videos", after);
    await refundDaily("u1", "videos", before);
    await refundDaily("u1", "videos", before);
    expect(await redis().get("test:limit:u1:videos:2026-10-25")).toBe("0");
    expect(await redis().get("test:limit:u1:videos:2026-10-26")).toBe("1");
  });
  it("uses Monday UTC and the retry reservation date for weekly finals", async () => {
    const { videoId } = await newVideo();
    const video = (await Video.findById(videoId))!;
    expect(weekWindow(new Date("2026-10-25T23:59:59Z")).reset.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    const start = new Date("2026-10-26T00:00:00Z");
    await Render.create([
      {
        workspaceId: video.workspaceId,
        videoId,
        scriptVersion: 1,
        kind: "final",
        status: "done",
        quotaAt: new Date(start.getTime() - 1),
      },
      { workspaceId: video.workspaceId, videoId, scriptVersion: 2, kind: "final", status: "queued", quotaAt: start },
      { workspaceId: video.workspaceId, videoId, scriptVersion: 3, kind: "final", status: "failed", quotaAt: start },
    ]);
    expect(await weeklyFinalCount(video.workspaceId, start)).toBe(1);
  });
});

it("releases the weekly retry reservation when enqueueing fails", async () => {
  const { videoId } = await newVideo("final");
  await drain("ai", fakes());
  await redis().set(budgetKeys.elevenLabsCredits(), 10_000);
  await drain("voice", fakes());
  const v = (await Video.findById(videoId))!;
  expect(await weeklyFinalCount(v.workspaceId)).toBe(0);
  const spy = vi.spyOn(queue("voice"), "add").mockRejectedValueOnce(new Error("fixture enqueue failure"));
  try {
    await expect(retryVideo(videoId)).rejects.toThrow("fixture enqueue failure");
  } finally {
    spy.mockRestore();
  }
  expect(await weeklyFinalCount(v.workspaceId)).toBe(0);
  expect((await Video.findById(videoId))?.status).toBe("failed");
});

describe("hosting: environments share one Redis", () => {
  it("knows whether the worker is running from its heartbeat", async () => {
    expect(await workerStatus()).toEqual({ online: false, lastSeen: null, startedAt: null });
    await beatWorker({ pid: 1, startedAt: "2026-10-28T10:00:00.000Z", node: "v22" }, new Date("2026-10-28T10:05:00Z"));
    expect(await workerStatus()).toEqual({
      online: true,
      lastSeen: "2026-10-28T10:05:00.000Z",
      startedAt: "2026-10-28T10:00:00.000Z",
    });
    const ttl = await redis().ttl(nsKey("worker:alive"));
    expect(ttl).toBeGreaterThan(60);
    expect(ttl).toBeLessThanOrEqual(90);
    await stopWorkerBeat(); // clean shutdown: offline at once, last seen kept
    expect(await workerStatus()).toMatchObject({ online: false, lastSeen: "2026-10-28T10:05:00.000Z" });
  });

  it("keeps each environment's keys and queues apart, but shares the provider budgets", async () => {
    expect(nsKey("worker:alive")).toBe("test:worker:alive");
    expect(bullPrefix()).toBe("test:bull");
    expect(queue("ai").opts.prefix).toBe("test:bull");
    await takeDaily("u-ns", "videos");
    expect(await redis().keys("limit:*")).toEqual([]);
    expect((await redis().keys("test:limit:u-ns:*")).length).toBe(1);
    expect(budgetKeys.geminiRequests()).toMatch(/^global:.*:test$/); // same API keys → one shared count, own part
  });

  it("serves every open video page from one Redis connection", async () => {
    const clients = async () =>
      ((await redis().client("LIST")) as string).split("\n").filter((l) => l.includes("name=clipwise:sub:videos"))
        .length;
    // CLIENT LIST covers the whole Redis server, where a running dev web app may have its own subscriber; earlier
    // tests may have opened this process's shared one, so start without it and count only the new connection.
    await closeSubscriptions();
    const before = await clients();
    const a: VideoEvent[] = [];
    const b: VideoEvent[] = [];
    const c: VideoEvent[] = [];
    const stopA = await subscribeVideoEvents("v1", (e) => a.push(e));
    const stopB = await subscribeVideoEvents("v1", (e) => b.push(e));
    const stopC = await subscribeVideoEvents("v2", (e) => c.push(e));
    expect(await clients()).toBe(before + 1);
    const status: VideoEvent = { type: "status", status: "scripting", stage: "script", progress: 10 };
    await publishVideoEvent("v1", status);
    await new Promise((r) => setTimeout(r, 50));
    expect(a).toEqual([status]);
    expect(b).toEqual([status]);
    expect(c).toEqual([]);
    await stopA();
    await stopA(); // stopping twice is harmless
    await publishVideoEvent("v1", status);
    await new Promise((r) => setTimeout(r, 50));
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);
    await stopB();
    await stopC();
    expect(await redis().pubsub("NUMSUB", "test:video:v1")).toEqual(["test:video:v1", 0]);
  });

  it("a second page opened at the same moment gets events as soon as its subscription returns", async () => {
    await closeSubscriptions();
    const a: VideoEvent[] = [];
    const b: VideoEvent[] = [];
    // Both start before the first SUBSCRIBE has finished; neither may return before events are flowing.
    const [stopA, stopB] = await Promise.all([
      subscribeVideoEvents("v3", (e) => a.push(e)),
      subscribeVideoEvents("v3", (e) => b.push(e)),
    ]);
    expect(await redis().pubsub("NUMSUB", "test:video:v3")).toEqual(["test:video:v3", 1]);
    const status: VideoEvent = { type: "status", status: "voicing", stage: "voice", progress: 50 };
    await publishVideoEvent("v3", status);
    await new Promise((r) => setTimeout(r, 50));
    expect(a).toEqual([status]);
    expect(b).toEqual([status]);
    await stopA();
    await stopB();
    // Reopening after everyone left subscribes again.
    const c: VideoEvent[] = [];
    const stopC = await subscribeVideoEvents("v3", (e) => c.push(e));
    await publishVideoEvent("v3", status);
    await new Promise((r) => setTimeout(r, 50));
    expect(c).toEqual([status]);
    await stopC();
  });
});

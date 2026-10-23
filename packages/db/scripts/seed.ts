import { readFileSync } from "node:fs";
import { dbName } from "../src/connection";
import { PipelineRun, Render, ScriptVersion, UsageEvent, Video, Workspace } from "../src/index";
import { isProductionDb, runScript } from "./env";

/**
 * Fills a dev or staging database with a sample workspace and three videos (previewed, rendered, failed)
 * built from real prototype runs, so every dashboard state can be checked without spending credits.
 * Re-running replaces the previous sample data. Refuses to touch production.
 */
const SEED_OWNER = "seed-user";
const LIAM = "TX3LPaxmHKxFdv7VOQHJ";
const seedFile = (name: string) => JSON.parse(readFileSync(new URL(`../seed/${name}`, import.meta.url), "utf8"));
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

await runScript(async () => {
  if (isProductionDb(dbName())) throw new Error("refusing to seed the production database");

  // Clear the previous sample data
  const old = await Workspace.findOne({ ownerUserId: SEED_OWNER });
  if (old) {
    const workspaceId = old._id;
    await Video.deleteMany({ workspaceId });
    await ScriptVersion.deleteMany({ workspaceId });
    await Render.deleteMany({ workspaceId });
    await PipelineRun.deleteMany({ workspaceId });
    await UsageEvent.deleteMany({ workspaceId });
    await old.deleteOne();
  }

  const ws = await Workspace.create({ ownerUserId: SEED_OWNER, name: "Sample workspace" });
  const owner = { workspaceId: ws._id };

  // 1. Rendered — GPS, 60s, from the prototype's final render
  const gps = seedFile("gps.script.json");
  const gpsVideo = await Video.create({
    ...owner,
    createdByUserId: SEED_OWNER,
    topic: "How does GPS know where you are?",
    format: "explainer",
    title: gps.title,
    lengthMode: "60",
    lengthSeconds: 60,
    voiceId: LIAM,
    status: "rendered",
    progress: 100,
    script: gps,
    scriptVersion: 1,
    factcheck: { checkedVersion: 1, claims: [], rewrites: 0 },
    voice: { scriptVersion: 1, voiceId: LIAM, model: "eleven_flash_v2_5", durationMs: 59_300, credits: 850 },
    createdAt: minutesAgo(90),
  });
  const gpsRun = await PipelineRun.create({
    ...owner,
    videoId: gpsVideo._id,
    trigger: "create",
    scriptVersion: 1,
    status: "ok",
    finishedAt: minutesAgo(85),
    stages: [
      { stage: "script", status: "ok", durationMs: 9_800, attempts: 1, units: { tokens: 5464 } },
      { stage: "factcheck", status: "ok", durationMs: 4_100, attempts: 1, units: { tokens: 1100 } },
      { stage: "voice", status: "ok", durationMs: 5_102, attempts: 2, units: { credits: 850 } },
      { stage: "render", status: "ok", durationMs: 173_565, attempts: 1, units: { frames: 1794 } },
    ],
  });
  const gpsRender = await Render.create({
    ...owner,
    videoId: gpsVideo._id,
    kind: "final",
    scriptVersion: 1,
    status: "done",
    r2Key: `seed/${gpsVideo._id}/renders/final.mp4`,
    durationMs: 59_800,
    sizeBytes: 9_400_000,
    renderMs: 173_565,
  });
  gpsVideo.finalRenderId = gpsRender._id;
  await gpsVideo.save();
  await ScriptVersion.create({ ...owner, videoId: gpsVideo._id, version: 1, source: "generated", script: gps });
  const gpsUsage = { ...owner, userId: SEED_OWNER, videoId: gpsVideo._id, pipelineRunId: gpsRun._id };
  await UsageEvent.create([
    {
      ...gpsUsage,
      provider: "gemini",
      operation: "script",
      model: "gemini-3.5-flash-lite",
      quantity: 5464,
      unit: "tokens",
    },
    {
      ...gpsUsage,
      provider: "gemini",
      operation: "factcheck",
      model: "gemini-3.5-flash-lite",
      quantity: 1100,
      unit: "tokens",
    },
    {
      ...gpsUsage,
      provider: "elevenlabs",
      operation: "voice",
      model: "eleven_flash_v2_5",
      quantity: 850,
      unit: "credits",
    },
  ]);

  // 2. Previewed — sky, 30s, script ready with two fact-check notes to review
  const sky = seedFile("sky.script.json");
  const fc = seedFile("sky.factcheck.json");
  const skyVideo = await Video.create({
    ...owner,
    createdByUserId: SEED_OWNER,
    topic: "Why is the sky blue?",
    format: "explainer",
    title: sky.title,
    lengthMode: "30",
    lengthSeconds: 30,
    voiceId: LIAM,
    status: "previewed",
    progress: 100,
    script: sky,
    scriptVersion: 2,
    factcheck: { checkedVersion: 2, claims: fc.remainingIssues, rewrites: fc.rewrites },
    createdAt: minutesAgo(30),
  });
  await ScriptVersion.create([
    { ...owner, videoId: skyVideo._id, version: 1, source: "generated", script: sky, model: fc.model },
    {
      ...owner,
      videoId: skyVideo._id,
      version: 2,
      source: "factcheck-rewrite",
      script: sky,
      changedScenes: [3],
      model: fc.model,
    },
  ]);
  await PipelineRun.create({
    ...owner,
    videoId: skyVideo._id,
    trigger: "create",
    scriptVersion: 2,
    status: "ok",
    finishedAt: minutesAgo(29),
    stages: [
      { stage: "script", status: "ok", durationMs: 8_200, attempts: 1 },
      { stage: "factcheck", status: "ok", durationMs: 6_900, attempts: 1, units: { tokens: fc.tokens, rewrites: 1 } },
    ],
  });

  // 3. Failed — the script stage gave up
  const failed = await Video.create({
    ...owner,
    createdByUserId: SEED_OWNER,
    topic: "Why do cats purr?",
    format: "tips",
    lengthMode: "auto",
    voiceId: LIAM,
    status: "failed",
    stage: "script",
    error: {
      stage: "script",
      code: "INTERNAL",
      message: "We couldn't write this script. Try again.",
      at: minutesAgo(5),
    },
    createdAt: minutesAgo(6),
  });
  await PipelineRun.create({
    ...owner,
    videoId: failed._id,
    trigger: "create",
    status: "failed",
    finishedAt: minutesAgo(5),
    stages: [{ stage: "script", status: "failed", attempts: 3, error: "Gemini returned invalid JSON 3 times (seed)" }],
  });

  console.log(`✓ seeded workspace "${ws.name}" with 3 videos (rendered, previewed, failed)`);
});

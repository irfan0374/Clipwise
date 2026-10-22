import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Invite, PipelineRun, Render, ScriptVersion, UsageEvent, Video, Workspace } from "../src/index";
import { gpsScript, newVideo, skyScript } from "./fixtures";

describe("videos", () => {
  it("saves the prototype's script output as-is", async () => {
    const script = gpsScript();
    const video = await Video.create(newVideo({ script, title: script.title, lengthSeconds: 60, scriptVersion: 1 }));
    const saved = await Video.findById(video._id).lean();
    expect(saved?.script).toEqual(script);
    expect(saved?.status).toBe("draft");
    expect(saved?.format).toBe("explainer");
  });

  it("rejects a script with too few scenes or an unknown visual", async () => {
    const short = skyScript();
    short.scenes = short.scenes.slice(0, 2);
    await expect(Video.create(newVideo({ script: short }))).rejects.toThrow(/3–10 scenes/);

    const badVisual = skyScript();
    badVisual.scenes[0].visual = { type: "hologram" };
    await expect(Video.create(newVideo({ script: badVisual }))).rejects.toThrow(/hologram/);
  });

  it("rejects unknown status, format and length", async () => {
    await expect(Video.create(newVideo({ status: "done" }))).rejects.toThrow(/status/);
    await expect(Video.create(newVideo({ format: "vlog" }))).rejects.toThrow(/format/);
    await expect(Video.create(newVideo({ lengthMode: "45" }))).rejects.toThrow(/lengthMode/);
  });

  it("drops fields that are not in the schema", async () => {
    const video = await Video.create(newVideo({ isAdmin: true }));
    const saved = await Video.findById(video._id).lean();
    expect(saved).not.toHaveProperty("isAdmin");
  });

  it("keeps soft-deleted videos out of the dashboard query", async () => {
    const workspaceId = new Types.ObjectId();
    await Video.create(newVideo({ workspaceId, topic: "kept" }));
    await Video.create(newVideo({ workspaceId, topic: "deleted", deletedAt: new Date() }));
    await Video.create(newVideo({ topic: "someone else's" }));
    const list = await Video.find({ workspaceId, deletedAt: null }).sort({ createdAt: -1 }).lean();
    expect(list.map((v) => v.topic)).toEqual(["kept"]);
  });

  it("stores fact-check claims with acceptedAt", async () => {
    const video = await Video.create(
      newVideo({
        factcheck: {
          checkedVersion: 1,
          claims: [{ scene: 1, text: "10x more blue", verdict: "imprecise", fix: "say 5x" }],
          rewrites: 1,
        },
      }),
    );
    expect(video.factcheck?.claims[0]?.acceptedAt).toBeNull();
  });
});

describe("unique rules", () => {
  it("allows one invite per email, case-insensitive", async () => {
    await Invite.create({ email: "Maya@Example.com" });
    await expect(Invite.create({ email: "maya@example.com " })).rejects.toThrow(/duplicate key/);
    expect((await Invite.findOne({ email: "maya@example.com" }))?.status).toBe("invited");
  });

  it("allows one workspace per user, and many without a Stripe customer", async () => {
    await Workspace.create({ ownerUserId: "u1", name: "Maya" });
    await Workspace.create({ ownerUserId: "u2", name: "Sam" }); // both stripeCustomerId null
    await expect(Workspace.create({ ownerUserId: "u1", name: "Again" })).rejects.toThrow(/duplicate key/);
    await Workspace.create({ ownerUserId: "u3", name: "A", stripeCustomerId: "cus_1" });
    await expect(Workspace.create({ ownerUserId: "u4", name: "B", stripeCustomerId: "cus_1" })).rejects.toThrow(
      /duplicate key/,
    );
  });

  it("allows one script version number per video", async () => {
    const base = { workspaceId: new Types.ObjectId(), videoId: new Types.ObjectId(), source: "generated" as const };
    await ScriptVersion.create({ ...base, version: 1, script: skyScript() });
    await ScriptVersion.create({ ...base, version: 2, source: "reordered" as const, script: skyScript() });
    await expect(ScriptVersion.create({ ...base, version: 1, script: skyScript() })).rejects.toThrow(/duplicate key/);
  });
});

describe("defaults", () => {
  it("fills workspace settings", async () => {
    const ws = await Workspace.create({ ownerUserId: "u1", name: "Maya" });
    expect(ws.plan).toBe("beta");
    expect(ws.settings?.defaultLength).toBe("60");
    expect(ws.settings?.defaultFormat).toBe("explainer");
  });

  it("creates renders, runs and usage events with their defaults", async () => {
    const owner = { workspaceId: new Types.ObjectId(), videoId: new Types.ObjectId() };
    const render = await Render.create({ ...owner, kind: "final", scriptVersion: 1 });
    expect([render.status, render.width, render.height]).toEqual(["queued", 1080, 1920]);

    const run = await PipelineRun.create({
      ...owner,
      trigger: "create",
      stages: [{ stage: "voice", status: "ok", units: { credits: 850, model: "eleven_flash_v2_5" } }],
    });
    expect(run.status).toBe("running");
    expect(run.stages[0]?.units).toEqual({ credits: 850, model: "eleven_flash_v2_5" });

    const usage = await UsageEvent.create({
      ...owner,
      userId: "u1",
      provider: "elevenlabs",
      operation: "voice",
      quantity: 850,
      unit: "credits",
    });
    expect(usage.costMicros).toBe(0);
    expect(usage).not.toHaveProperty("updatedAt");
  });
});

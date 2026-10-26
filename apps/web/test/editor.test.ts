import { allModels, connectDb, disconnectDb, ScriptVersion, Video, Workspace } from "@clipwise/db";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { validScript } from "../../../packages/pipeline/test/fixtures";

vi.mock("@clipwise/queue", () => ({
  FinalError: class extends Error {},
  enqueueRecheck: vi.fn().mockResolvedValue(undefined),
  publishVideoEvent: vi.fn().mockResolvedValue(undefined),
  refundDaily: vi.fn(),
  secondsUntilReset: () => 1,
  takeDaily: async () => true,
  userLimits: () => ({ aiEditsPerDay: 30 }),
}));
let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb({ uri: mongo.getUri("clipwise_editor_test") });
  await Promise.all(allModels.map((m) => m.syncIndexes()));
});
afterAll(async () => {
  await disconnectDb();
  await mongo?.stop();
});
beforeEach(async () => {
  await Promise.all(allModels.map((m) => m.deleteMany({})));
});

const state = vi.hoisted(() => ({ workspaceId: "", videoId: "" }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({
  requireUser: async () => ({ user: { id: "u1" }, workspace: { _id: state.workspaceId } }),
}));
vi.mock("@/lib/budget", () => ({ asWorkspace: async (_: unknown, fn: () => Promise<unknown>) => fn() }));
vi.mock("@/lib/videos", () => ({
  plainScript: (s: unknown) => JSON.parse(JSON.stringify(s)),
  videoForOwner: async () => ({ id: state.videoId }),
  scriptVersions: async () => [],
}));

import {
  addScene,
  deleteScene,
  reorderScenes,
  restoreVersion,
  updateScene,
} from "../../../apps/web/app/(app)/edit-actions";

beforeEach(async () => {
  const ws = await Workspace.create({ ownerUserId: "u1", name: "Editor test" });
  state.workspaceId = ws._id.toString();
  const script = validScript();
  const video = await Video.create({
    workspaceId: ws._id,
    createdByUserId: "u1",
    topic: "Sky",
    format: "explainer",
    lengthMode: "30",
    voiceId: "TX3LPaxmHKxFdv7VOQHJ",
    script,
    scriptVersion: 1,
    status: "previewed",
    factcheck: { checkedVersion: 1, claims: [], pendingScenes: [] },
  });
  state.videoId = video._id.toString();
  await ScriptVersion.create({
    workspaceId: ws._id,
    videoId: video._id,
    version: 1,
    source: "generated",
    script,
    changedScenes: [],
  });
});
const input = () => ({
  videoId: state.videoId,
  expectedVersion: 1,
  sceneIndex: 1,
  patch: { narration: "Air scatters sunlight in different directions." },
});

describe("editor persistence and concurrency", () => {
  it("saves an edited script version and schedules only changed scenes for checking", async () => {
    expect((await updateScene(input())).ok).toBe(true);
    const v = await Video.findById(state.videoId).lean();
    expect(v?.scriptVersion).toBe(2);
    expect(v?.factcheck?.pendingScenes).toEqual([1]);
    expect(await ScriptVersion.countDocuments({ videoId: state.videoId })).toBe(2);
  });
  it("allows only one concurrent edit with the same expected version", async () => {
    const results = await Promise.all([
      updateScene(input()),
      updateScene({ ...input(), patch: { narration: "Another tab changed this scene." } }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.error.code)).toEqual(["CONFLICT"]);
    expect(await ScriptVersion.countDocuments({ videoId: state.videoId })).toBe(2);
  });
  it("rejects edits owned by another workspace", async () => {
    state.workspaceId = "000000000000000000000001";
    expect(await updateScene(input())).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect((await Video.findById(state.videoId))?.scriptVersion).toBe(1);
  });
  it("preserves an existing final while marking later edits as needing another render", async () => {
    await Video.updateOne(
      { _id: state.videoId },
      { $set: { status: "rendered", finalRenderId: "000000000000000000000002" } },
    );
    expect((await updateScene(input())).ok).toBe(true);
    const v = await Video.findById(state.videoId).lean();
    expect(v?.status).toBe("previewed");
    expect(v?.finalRenderId?.toString()).toBe("000000000000000000000002");
  });
  it("restores history as a new version rather than replacing existing history", async () => {
    const original = (await Video.findById(state.videoId))!.script!.scenes[1]!.narration;
    await updateScene(input());
    expect((await restoreVersion({ videoId: state.videoId, expectedVersion: 2, version: 1 })).ok).toBe(true);
    const v = await Video.findById(state.videoId).lean();
    expect(v?.scriptVersion).toBe(3);
    expect(v?.script?.scenes[1]?.narration).toBe(original);
    expect(await ScriptVersion.countDocuments({ videoId: state.videoId })).toBe(3);
  });
  it("adds, reorders and deletes scenes while keeping their indices contiguous", async () => {
    expect((await addScene({ videoId: state.videoId, expectedVersion: 1, afterIndex: 1, mode: "blank" })).ok).toBe(
      true,
    );
    expect((await reorderScenes({ videoId: state.videoId, expectedVersion: 2, order: [0, 2, 1, 3, 4, 5] })).ok).toBe(
      true,
    );
    expect((await deleteScene({ videoId: state.videoId, expectedVersion: 3, sceneIndex: 1 })).ok).toBe(true);
    const v = await Video.findById(state.videoId).lean();
    expect(v?.script?.scenes.map((s) => s.index)).toEqual([0, 1, 2, 3, 4]);
  });
});

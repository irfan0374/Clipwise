import { AuditEvent, accountUsers, allModels, connectDb, disconnectDb, Workspace } from "@clipwise/db";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "user",
  workspaceId: "",
  pause: vi.fn(),
  retry: vi.fn(),
  hash: vi.fn(),
  update: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("404");
  },
}));
vi.mock("@/lib/session", () => ({
  requireUser: async () => ({ user: { id: "actor", role: state.role }, workspace: { _id: state.workspaceId } }),
}));
vi.mock("@/lib/auth", () => ({
  auth: {
    $context: Promise.resolve({
      password: { hash: state.hash },
      internalAdapter: {
        findAccounts: async () => [{ providerId: "credential" }],
        updatePassword: state.update,
        deleteUserSessions: state.revoke,
      },
    }),
  },
}));
vi.mock("@clipwise/queue", () => ({
  FinalError: class extends Error {},
  setGenerationPaused: state.pause,
  retryVideo: state.retry,
  budgetStatus: async () => ({ gemini: { used: 0, limit: 80 }, elevenlabs: { used: 0, limit: 10000 } }),
  weeklyFinalCount: async () => 0,
  queue: () => ({
    isPaused: async () => false,
    getJobCounts: async () => ({ active: 0, waiting: 0, failed: 0, delayed: 0 }),
  }),
}));

import {
  pauseGeneration,
  resetUserPassword,
  retryFailedVideo,
  suspendWorkspace,
  viewRunLog,
} from "../app/(app)/admin/actions";
import { updateSettings } from "../app/(app)/settings/actions";
import { adminOverview, requireAdmin } from "../lib/admin";
import { navigationFor } from "../lib/nav";

let mongo: MongoMemoryServer;
let targetId: string;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("clipwise_admin_test");
  await connectDb();
  await Promise.all(allModels.map((m) => m.syncIndexes()));
});
afterAll(async () => {
  await disconnectDb();
  await mongo.stop();
});
beforeEach(async () => {
  vi.clearAllMocks();
  state.pause.mockReset().mockResolvedValue(undefined);
  state.hash.mockResolvedValue("fixture-hash");
  state.role = "user";
  await Promise.all(allModels.map((m) => m.deleteMany({})));
  const users = await accountUsers();
  await users.deleteMany({});
  await users.insertMany([
    { _id: "actor", name: "Actor", email: "actor@test.invalid", role: "admin" },
    { _id: "member", name: "Member", email: "member@test.invalid", role: "user" },
  ]);
  const own = await Workspace.create({ ownerUserId: "actor", name: "Own" });
  state.workspaceId = own.id;
  const target = await Workspace.create({ ownerUserId: "member", name: "Other" });
  targetId = target.id;
});
const defaults = () => ({
  name: "  My studio  ",
  defaultFormat: "story" as const,
  defaultLength: "30" as const,
  defaultVoiceId: "TX3LPaxmHKxFdv7VOQHJ" as const,
});
describe("workspace settings", () => {
  it("saves only the session workspace, ignoring a supplied workspace identifier", async () => {
    expect(await updateSettings({ ...defaults(), workspaceId: targetId } as ReturnType<typeof defaults>)).toMatchObject(
      { ok: true },
    );
    expect(await Workspace.findById(state.workspaceId).lean()).toMatchObject({
      name: "My studio",
      settings: { defaultFormat: "story", defaultLength: "30" },
    });
    expect((await Workspace.findById(targetId))?.name).toBe("Other");
  });
  it("rejects empty names and non-allowlisted voices without writing", async () => {
    expect(await updateSettings({ ...defaults(), name: " " })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
    expect(
      await updateSettings({
        ...defaults(),
        defaultVoiceId: "unknown" as ReturnType<typeof defaults>["defaultVoiceId"],
      }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect((await Workspace.findById(state.workspaceId))?.name).toBe("Own");
  });
});
describe("administrator authorization and audit", () => {
  it("denies every admin action and page to ordinary users before any mutation", async () => {
    const results = await Promise.all([
      pauseGeneration({ paused: true, queue: "all" }),
      suspendWorkspace({ workspaceId: targetId, suspended: true }),
      resetUserPassword({ workspaceId: targetId, newPassword: "FixturePassword123!" }),
      retryFailedVideo({ videoId: targetId }),
      viewRunLog({ videoId: targetId }),
    ]);
    for (const r of results) expect(r).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    await expect(requireAdmin()).rejects.toThrow("404");
    expect(navigationFor("user").some((n) => n.href === "/admin")).toBe(false);
    expect(state.pause).not.toHaveBeenCalled();
    expect(state.hash).not.toHaveBeenCalled();
    expect(await AuditEvent.countDocuments()).toBe(0);
  });
  it("audits both successful and failed queue changes", async () => {
    state.role = "admin";
    expect(await pauseGeneration({ paused: true, queue: "voice" })).toMatchObject({ ok: true });
    state.pause.mockRejectedValueOnce(new Error("offline"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await pauseGeneration({ paused: false, queue: "voice" })).toMatchObject({
      ok: false,
      error: { code: "INTERNAL" },
    });
    spy.mockRestore();
    expect((await AuditEvent.find().sort({ createdAt: 1 })).map((a) => [a.action, a.status])).toEqual([
      ["generation.pause", "ok"],
      ["generation.resume", "failed"],
    ]);
  });
  it("suspends and reactivates a member and revokes existing sessions", async () => {
    state.role = "admin";
    expect(await suspendWorkspace({ workspaceId: targetId, suspended: true })).toMatchObject({ ok: true });
    expect((await Workspace.findById(targetId))?.suspendedAt).toBeInstanceOf(Date);
    expect(state.revoke).toHaveBeenCalledWith("member");
    expect(await suspendWorkspace({ workspaceId: targetId, suspended: false })).toMatchObject({ ok: true });
    expect((await Workspace.findById(targetId))?.suspendedAt).toBeNull();
  });
  it("protects administrator workspaces and refuses self reset", async () => {
    state.role = "admin";
    expect(await suspendWorkspace({ workspaceId: state.workspaceId, suspended: true })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(
      await resetUserPassword({ workspaceId: state.workspaceId, newPassword: "FixturePassword123!" }),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(state.revoke).not.toHaveBeenCalled();
    expect(await AuditEvent.countDocuments()).toBe(0);
  });
  it("hashes a member reset, revokes sessions, and never stores the password in the audit record", async () => {
    state.role = "admin";
    const password = "FixturePassword123!";
    expect(await resetUserPassword({ workspaceId: targetId, newPassword: password })).toMatchObject({ ok: true });
    expect(state.hash).toHaveBeenCalledWith(password);
    expect(state.update).toHaveBeenCalledWith("member", "fixture-hash");
    expect(state.revoke).toHaveBeenCalledWith("member");
    const audit = await AuditEvent.find().lean();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "password.reset", status: "ok" });
    expect(JSON.stringify(audit)).not.toContain(password);
    expect(JSON.stringify(audit)).not.toContain("fixture-hash");
  });
});

it("searches account emails and paginates workspace results with safe metadata", async () => {
  state.role = "admin";
  const result = await adminOverview("member@test.invalid");
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]).toMatchObject({ id: targetId, email: "member@test.invalid", role: "user" });
  await Workspace.insertMany(Array.from({ length: 21 }, (_, i) => ({ ownerUserId: `extra-${i}`, name: `Extra ${i}` })));
  const page = await adminOverview("", 999);
  expect(page.page).toBe(2);
  expect(page.total).toBe(23);
  expect(page.rows).toHaveLength(3);
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  getSession: vi.fn(),
  video: vi.fn(),
  render: vi.fn(),
  workspace: vi.fn(),
  exists: vi.fn(),
  signedUrl: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSession: fake.getSession }));
vi.mock("@clipwise/db", () => ({
  connectDb: vi.fn(),
  Workspace: { findOne: fake.workspace },
  Video: { findOne: fake.video },
  Render: { findOne: fake.render },
}));
vi.mock("@clipwise/storage", () => ({ storage: () => ({ exists: fake.exists, signedUrl: fake.signedUrl }) }));

import { GET } from "../app/api/videos/[id]/download/route";

const id = "000000000000000000000001";
const request = (query = "") =>
  GET(new Request(`http://localhost/api/videos/${id}/download${query}`), { params: Promise.resolve({ id }) });
beforeEach(() => {
  vi.clearAllMocks();
  fake.getSession.mockResolvedValue({ user: { id: "u1" } });
  fake.workspace.mockReturnValue({ lean: async () => ({ _id: "owner-ws" }) });
  fake.video.mockReturnValue({ lean: async () => ({ _id: id, title: 'Sky "blue"', topic: "Sky" }) });
  fake.render.mockReturnValue({ sort: () => ({ lean: async () => ({ r2Key: "owner/video.mp4" }) }) });
  fake.exists.mockResolvedValue(true);
  fake.signedUrl.mockResolvedValue("http://localhost/signed");
});
describe("MP4 download authorization", () => {
  it("requires authentication", async () => {
    fake.getSession.mockResolvedValue(null);
    expect((await request()).status).toBe(401);
    expect(fake.video).not.toHaveBeenCalled();
  });
  it("doesn't reveal another workspace's render", async () => {
    fake.video.mockReturnValue({ lean: async () => null });
    expect((await request()).status).toBe(404);
    expect(fake.render).not.toHaveBeenCalled();
  });
  it("checks workspace, video, completed status and final kind even for an explicit render id", async () => {
    const renderId = "000000000000000000000002";
    const res = await request(`?renderId=${renderId}`);
    expect(res.status).toBe(302);
    expect(fake.video).toHaveBeenCalledWith({ _id: id, workspaceId: "owner-ws", deletedAt: null });
    expect(fake.render).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: renderId,
        videoId: id,
        workspaceId: "owner-ws",
        status: "done",
        kind: "final",
        deletedAt: null,
      }),
    );
    expect(fake.signedUrl).toHaveBeenCalledWith("owner/video.mp4", { expiresIn: 3600, downloadName: "Sky-blue.mp4" });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
  it("returns 404 for missing files and malformed render IDs", async () => {
    fake.exists.mockResolvedValue(false);
    expect((await request()).status).toBe(404);
    expect((await request("?renderId=bad")).status).toBe(404);
    expect(fake.signedUrl).not.toHaveBeenCalled();
  });
});

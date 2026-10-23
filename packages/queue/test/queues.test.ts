import { describe, expect, it } from "vitest";
import { budgetKeys, enqueue, jobIdFor } from "../src/index";

const id = "64b7f0c2a1b2c3d4e5f60718";
const run = "64b7f0c2a1b2c3d4e5f60719";
const render = "64b7f0c2a1b2c3d4e5f6071a";

describe("job ids", () => {
  it("are deterministic and contain no ':' (BullMQ custom ids)", () => {
    expect(jobIdFor("script", { videoId: id, runId: run })).toBe(`vid_${id}_script_${run}`);
    expect(jobIdFor("factcheck", { videoId: id, runId: run, scriptVersion: 2 })).toBe(`vid_${id}_factcheck_v2_${run}`);
    expect(jobIdFor("render", { videoId: id, runId: run, renderId: render, scriptVersion: 3, kind: "final" })).toBe(
      `vid_${id}_render_v3_${render}`,
    );
    for (const name of ["script", "factcheck"] as const) {
      expect(jobIdFor(name, { videoId: id, runId: run, scriptVersion: 1 })).not.toContain(":");
    }
  });
});

describe("enqueue", () => {
  it("rejects payloads that are not IDs, before touching Redis", async () => {
    await expect(enqueue("script", { videoId: "not-an-id", runId: run })).rejects.toThrow();
    await expect(
      enqueue("render", { videoId: id, runId: run, renderId: render, scriptVersion: 1, kind: "gif" as "final" }),
    ).rejects.toThrow();
  });
});

describe("budget keys", () => {
  it("are per day for Gemini and per month for ElevenLabs", () => {
    const d = new Date("2026-10-23T10:00:00Z");
    expect(budgetKeys.geminiRequests(d)).toBe("global:gemini:requests:2026-10-23");
    expect(budgetKeys.elevenLabsCredits(d)).toBe("global:elevenlabs:2026-10");
  });
});

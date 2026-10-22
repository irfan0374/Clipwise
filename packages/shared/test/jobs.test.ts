import { describe, expect, it } from "vitest";
import { Formats, jobId, Queues, RenderJob, ScriptJob, VideoStatuses } from "../src/index";

const id = "64b7f0c2a1b2c3d4e5f60718";

describe("job payloads", () => {
  it("accept IDs only and reject anything else", () => {
    expect(ScriptJob.parse({ videoId: id, runId: id })).toEqual({ videoId: id, runId: id });
    expect(ScriptJob.safeParse({ videoId: "abc", runId: id }).success).toBe(false);
    expect(RenderJob.safeParse({ videoId: id, runId: id, renderId: id, scriptVersion: 2, kind: "gif" }).success).toBe(
      false,
    );
  });

  it("build deterministic job IDs", () => {
    expect(jobId.script(id, 1)).toBe(`vid:${id}:script:v1`);
    expect(jobId.scene(id, 3, 4)).toBe(`vid:${id}:scene3:v4`);
    expect(jobId.render(id, 2)).toBe(`vid:${id}:render:v2`);
    expect(jobId.publish(id)).toBe(`post_${id}`);
  });

  it("names the four queues", () => {
    expect(Object.values(Queues)).toEqual(["ai", "voice", "render", "publish"]);
  });
});

describe("enums", () => {
  it("lists video statuses in pipeline order", () => {
    expect(VideoStatuses[0]).toBe("draft");
    expect(VideoStatuses).toContain("previewed");
    expect(Formats).toHaveLength(6);
  });
});

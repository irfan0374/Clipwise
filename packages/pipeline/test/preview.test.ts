import { describe, expect, it } from "vitest";
import { previewTimeline } from "../src/web";
import { validScript } from "./fixtures";

describe("previewTimeline (storyboard player)", () => {
  it("is silent, covers every scene back to back, and times captions from the narration", () => {
    const script = validScript();
    const t = previewTimeline(script);
    expect(t.audioFile).toBeNull();
    expect(t.scenes.map((s) => s.index)).toEqual([0, 1, 2, 3, 4]);
    expect(t.scenes[0]?.startFrame).toBe(0);
    for (let i = 1; i < t.scenes.length; i++) expect(t.scenes[i]?.startFrame).toBe(t.scenes[i - 1]?.endFrame);
    expect(t.scenes.at(-1)?.endFrame).toBe(t.durationInFrames);
    const words = script.scenes.reduce((n, s) => n + s.narration.split(/\s+/).length, 0);
    expect(t.words).toHaveLength(words);
    // about 2.5 words per second
    expect(t.durationInFrames / 30).toBeGreaterThan(words / 2.5);
    expect(t.durationInFrames / 30).toBeLessThan(words / 2.5 + 3);
  });
});

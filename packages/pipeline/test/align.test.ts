import { describe, expect, it } from "vitest";
import { alignmentToWords, buildCaptionPages, buildTimeline, lengthVerdict, spokenSeconds } from "../src/stages/align";
import { narrationText } from "../src/stages/voice";
import { fakeAlignment, validScript } from "./fixtures";

describe("alignmentToWords", () => {
  it("groups characters into timed words", () => {
    const result = alignmentToWords(fakeAlignment("Hi there.", 0.1));
    expect(result.map((w) => w.text)).toEqual(["Hi", "there."]);
    expect(result[0]!.start).toBeCloseTo(0);
    expect(result[0]!.end).toBeCloseTo(0.2);
    expect(result[1]!.start).toBeCloseTo(0.3);
    expect(result[1]!.end).toBeCloseTo(0.9);
  });
});

describe("lengthVerdict", () => {
  it("accepts within 10%", () => {
    expect(lengthVerdict(27, 30)).toEqual({ action: "accept" });
    expect(lengthVerdict(66, 60)).toEqual({ action: "accept" });
  });
  it("adjusts speed when 10-20% off", () => {
    expect(lengthVerdict(35, 30)).toEqual({ action: "adjustSpeed", speed: 1.17 });
    expect(lengthVerdict(51, 60)).toEqual({ action: "adjustSpeed", speed: 0.85 });
  });
  it("asks for a new script when more than 20% off", () => {
    const verdict = lengthVerdict(80, 60);
    expect(verdict.action).toBe("rescript");
    if (verdict.action === "rescript") expect(verdict.feedback).toContain("Cut words");
  });
});

describe("buildCaptionPages", () => {
  const w = (text: string, start: number) => ({ text, startFrame: start, endFrame: start + 5 });

  it("caps pages at four words and breaks after punctuation", () => {
    const words = [w("one", 0), w("two", 6), w("three", 12), w("four", 18), w("five", 24), w("end.", 30), w("next", 36)];
    const pages = buildCaptionPages(words, 60);
    expect(pages.map((p) => p.wordIndexes)).toEqual([[0, 1, 2, 3], [4, 5], [6]]);
  });

  it("starts a new page when a page would last over 1.2 seconds", () => {
    const words = [w("slow", 0), w("words", 20), w("here", 40)];
    expect(buildCaptionPages(words, 60).map((p) => p.wordIndexes)).toEqual([[0, 1], [2]]);
  });

  it("keeps each page up until the next starts", () => {
    const pages = buildCaptionPages([w("a.", 0), w("b.", 10)], 30);
    expect(pages).toEqual([
      { startFrame: 0, endFrame: 10, wordIndexes: [0] },
      { startFrame: 10, endFrame: 30, wordIndexes: [1] },
    ]);
  });
});

describe("buildTimeline", () => {
  it("places scenes on the spoken words and fills the whole video", () => {
    const script = validScript();
    const alignment = fakeAlignment(narrationText(script));
    const timeline = buildTimeline({ script, alignment, audioFile: "voice.mp3", imageFiles: { 1: "scene-1.jpg" } });

    expect(timeline.durationInFrames).toBe(Math.round((spokenSeconds(alignment) + 0.5) * 30));
    expect(timeline.words).toHaveLength(70);
    expect(timeline.scenes[0]!.startFrame).toBe(0);
    timeline.scenes.forEach((scene, i) => {
      const next = timeline.scenes[i + 1];
      expect(scene.endFrame).toBe(next ? next.startFrame : timeline.durationInFrames);
      expect(scene.endFrame).toBeGreaterThan(scene.startFrame);
    });
    // Scene 1 starts exactly when its first word is spoken.
    const firstWordOfScene1 = timeline.words[script.hook.split(" ").length]!;
    expect(timeline.scenes[1]!.startFrame).toBe(firstWordOfScene1.startFrame);
    expect(timeline.scenes[1]!.imageFile).toBe("scene-1.jpg");
    expect(timeline.captionPages.flatMap((p) => p.wordIndexes)).toEqual(timeline.words.map((_, i) => i));
  });

  it("passes each scene's visual to the timeline", () => {
    const script = validScript();
    const timeline = buildTimeline({ script, alignment: fakeAlignment(narrationText(script)), audioFile: null, imageFiles: {} });
    expect(timeline.scenes[0]!.visual).toEqual({ type: "icon", icon: "sun" });
    expect(timeline.scenes[2]!.visual).toBeUndefined();
  });

  it("falls back to bullets when an imageFocus scene has no image", () => {
    const script = validScript();
    const timeline = buildTimeline({ script, alignment: fakeAlignment(narrationText(script)), audioFile: null, imageFiles: {} });
    expect(timeline.scenes[1]!.template).toBe("bullets");
    expect(timeline.scenes[1]!.imageFile).toBeUndefined();
  });

  it("refuses an alignment that doesn't match the script", () => {
    const script = validScript();
    expect(() => buildTimeline({ script, alignment: fakeAlignment("too few words"), audioFile: null, imageFiles: {} })).toThrow(/Alignment has 3 words/);
  });
});

describe("estimateAlignment", () => {
  it("times a 75-word narration at about 30 seconds and keeps every character", async () => {
    const { estimateAlignment } = await import("../src/stages/align");
    const text = Array.from({ length: 15 }, () => "Light scatters off gas molecules.").join(" ");
    const alignment = estimateAlignment(text);
    expect(alignment.characters.join("")).toBe(text);
    expect(spokenSeconds(alignment)).toBeGreaterThan(27);
    expect(spokenSeconds(alignment)).toBeLessThan(33);
    const starts = alignment.characterStartTimesSeconds;
    expect(starts.every((t, i) => i === 0 || t >= starts[i - 1]!)).toBe(true);
  });
});

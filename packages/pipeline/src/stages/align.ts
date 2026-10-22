import type { CaptionPage, Timeline, TimelineScene, TimelineWord } from "@clipwise/video";
import { FatalError } from "../retry";
import type { Alignment, Length, Script } from "../types";

export const FPS = 30;
const TAIL_SECONDS = 0.5;
const MAX_PAGE_WORDS = 4;
const MAX_PAGE_SECONDS = 1.2;

const toFrame = (seconds: number) => Math.round(seconds * FPS);

type TimedWord = { text: string; start: number; end: number };

/** Groups ElevenLabs character timestamps into words by splitting on whitespace. */
export const alignmentToWords = (alignment: Alignment): TimedWord[] => {
  const words: TimedWord[] = [];
  let current: TimedWord | null = null;
  alignment.characters.forEach((char, i) => {
    const start = alignment.characterStartTimesSeconds[i] ?? 0;
    const end = alignment.characterEndTimesSeconds[i] ?? start;
    if (/\s/.test(char)) {
      if (current) words.push(current);
      current = null;
      return;
    }
    if (current) {
      current.text += char;
      current.end = end;
    } else {
      current = { text: char, start, end };
    }
  });
  if (current) words.push(current);
  return words;
};

/**
 * Fake character timestamps for silent previews: words at the narrator's ~2.5 words/second,
 * with short pauses after commas and sentence ends. Lets the whole video render with zero voice credits.
 */
export const estimateAlignment = (text: string, wordsPerSecond = 2.5): Alignment => {
  const characters = [...text];
  const words = text.trim().split(/\s+/).filter(Boolean);
  // The speaking rate already includes pauses, so pause time comes out of the per-character time.
  const pauseAfter = (i: number) => {
    if (!/\s/.test(characters[i] ?? "")) return 0;
    const prev = characters[i - 1] ?? "";
    return /[.!?]/.test(prev) ? 0.3 : /[,;:]/.test(prev) ? 0.15 : 0;
  };
  const pauses = characters.reduce((sum, _, i) => sum + pauseAfter(i), 0);
  const perChar = Math.max(0.01, (words.length / wordsPerSecond - pauses) / Math.max(1, characters.length));
  const starts: number[] = [];
  const ends: number[] = [];
  let t = 0;
  characters.forEach((_, i) => {
    starts.push(t);
    t += perChar + pauseAfter(i);
    ends.push(t);
  });
  return { characters, characterStartTimesSeconds: starts, characterEndTimesSeconds: ends };
};

/** Audio length implied by the alignment (end of the last character). */
export const spokenSeconds = (alignment: Alignment) => alignment.characterEndTimesSeconds.at(-1) ?? 0;

export type LengthVerdict =
  | { action: "accept" }
  | { action: "adjustSpeed"; speed: number }
  | { action: "rescript"; feedback: string };

/** Within ±10% accept; 10–20% off re-voice at a corrected speed; more than 20% off rewrite the script. */
export const lengthVerdict = (seconds: number, target: Length): LengthVerdict => {
  const ratio = seconds / target;
  if (ratio >= 0.9 && ratio <= 1.1) return { action: "accept" };
  if (ratio >= 0.8 && ratio <= 1.2) {
    return { action: "adjustSpeed", speed: Math.min(1.2, Math.max(0.8, Number(ratio.toFixed(2)))) };
  }
  return {
    action: "rescript",
    feedback: `The narration took ${seconds.toFixed(1)} seconds to speak; it must take about ${target} seconds. ${ratio > 1 ? "Cut" : "Add"} words.`,
  };
};

const endsPhrase = (text: string) => /[.,!?;:]$/.test(text);

export const buildCaptionPages = (words: TimelineWord[], durationInFrames: number): CaptionPage[] => {
  const pages: CaptionPage[] = [];
  let page: number[] = [];
  const flush = () => {
    if (page.length) pages.push({ startFrame: words[page[0]!]!.startFrame, endFrame: 0, wordIndexes: page });
    page = [];
  };

  words.forEach((word, i) => {
    if (page.length) {
      const first = words[page[0]!]!;
      if (page.length >= MAX_PAGE_WORDS || word.endFrame - first.startFrame > MAX_PAGE_SECONDS * FPS) flush();
    }
    page.push(i);
    if (endsPhrase(word.text)) flush();
  });
  flush();

  // Each page stays up until the next one starts, so captions never flicker off mid-sentence.
  pages.forEach((p, i) => {
    p.endFrame = pages[i + 1]?.startFrame ?? durationInFrames;
  });
  return pages;
};

/** Spreads scene i's words to find where each scene starts in the spoken audio. */
export const buildTimeline = ({
  script,
  alignment,
  audioFile,
  imageFiles,
}: {
  script: Script;
  alignment: Alignment;
  audioFile: string | null;
  imageFiles: Record<number, string>;
}): Timeline => {
  const spoken = alignmentToWords(alignment);
  const sceneWordCounts = script.scenes.map((s) => s.narration.trim().split(/\s+/).filter(Boolean).length);
  const expected = sceneWordCounts.reduce((a, b) => a + b, 0);
  if (spoken.length !== expected) {
    throw new FatalError(`Alignment has ${spoken.length} words but the script has ${expected}; cannot place scenes.`);
  }

  const durationInFrames = toFrame(spokenSeconds(alignment) + TAIL_SECONDS);
  const words: TimelineWord[] = spoken.map((w) => ({
    text: w.text,
    startFrame: toFrame(w.start),
    endFrame: Math.max(toFrame(w.end), toFrame(w.start) + 1),
  }));

  let cursor = 0;
  const sceneStarts = sceneWordCounts.map((count) => {
    const start = cursor;
    cursor += count;
    return start;
  });

  const scenes: TimelineScene[] = script.scenes.map((scene, i) => {
    const startFrame = i === 0 ? 0 : words[sceneStarts[i]!]!.startFrame;
    const nextStart = sceneStarts[i + 1];
    const endFrame = nextStart === undefined ? durationInFrames : words[nextStart]!.startFrame;
    const imageFile = imageFiles[scene.index];
    // A scene whose image couldn't be found falls back to bullets.
    const template = scene.template === "imageFocus" && !imageFile ? "bullets" : scene.template;
    return {
      index: scene.index,
      template,
      startFrame,
      endFrame,
      onScreenText: scene.onScreenText,
      ...(template === "imageFocus" && imageFile ? { imageFile } : {}),
      ...(scene.stat ? { stat: scene.stat } : {}),
      ...(scene.visual && template !== "stat" ? { visual: scene.visual } : {}),
    };
  });

  return {
    fps: FPS,
    width: 1080,
    height: 1920,
    durationInFrames,
    audioFile,
    scenes,
    words,
    captionPages: buildCaptionPages(words, durationInFrames),
  };
};

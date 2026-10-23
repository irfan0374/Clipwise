import { ParticleMotions, VisualColors, VisualTypes } from "@clipwise/video";
import { z } from "zod";

export const Lengths = [30, 60] as const;
export type Length = (typeof Lengths)[number];

export const VisualItemSchema = z.object({
  icon: z.string().optional().describe("Icon name from the icon list"),
  label: z.string().optional().describe("1-3 words, max 18 characters"),
  value: z.number().optional().describe("bars: the bar's value; waves: wavelength 1 (short) to 10 (long)"),
  color: z.enum(VisualColors).optional(),
});

export const VisualSchema = z.object({
  type: z.enum(VisualTypes),
  icon: z.string().optional().describe("Main icon for icon, orbit, particles and network"),
  items: z.array(VisualItemSchema).max(6).optional(),
  motion: z.enum(ParticleMotions).optional().describe("particles only"),
  color: z.enum(VisualColors).optional().describe("Main colour of the visual"),
});

export const SceneSchema = z.object({
  index: z.number().int().min(0),
  narration: z.string().min(1).describe("Exactly what the voice says in this scene"),
  template: z.enum(["title", "bullets", "imageFocus", "stat"]),
  onScreenText: z.array(z.string().min(1)).min(1).max(3).describe("1-3 short lines, max 6 words each"),
  imageQuery: z.string().optional().describe("Concrete stock-photo search query; required for imageFocus"),
  stat: z.object({ value: z.string(), label: z.string() }).optional().describe("Required for stat scenes"),
  visual: VisualSchema.optional().describe(
    "Animated illustration; required for every scene except stat and imageFocus",
  ),
});

export const ScriptSchema = z.object({
  title: z.string().min(1).max(60),
  lengthSeconds: z.union([z.literal(30), z.literal(60)]),
  hook: z.string().min(1),
  scenes: z.array(SceneSchema).min(3).max(10),
  cta: z.string().min(1),
});

export type Scene = z.infer<typeof SceneSchema>;
export type Visual = z.infer<typeof VisualSchema>;
export type Script = z.infer<typeof ScriptSchema>;

/** Speech rate the word budget is based on (words per second). */
export const WORDS_PER_SECOND = 2.5;

/**
 * Word budget and scene counts per length. The prompt asks for the ideal scene count (minScenes–maxScenes);
 * validation also accepts the wider allowed range, so a list topic ("4 exercises" = hook + 4 + ending) fits.
 */
export const lengthRules: Record<
  Length,
  { minWords: number; maxWords: number; minScenes: number; maxScenes: number; allowedScenes: [number, number] }
> = {
  30: { minWords: 65, maxWords: 80, minScenes: 4, maxScenes: 5, allowedScenes: [3, 6] },
  60: { minWords: 130, maxWords: 155, minScenes: 7, maxScenes: 9, allowedScenes: [5, 9] },
};

/** Narration below this share of minWords is rejected; voice speed correction (0.8–1.2x) covers the rest. */
export const WORD_FLOOR = 0.8;

/** Character-level timestamps as returned by ElevenLabs (`alignment`). */
export type Alignment = {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
};

export type StageName = "script" | "factcheck" | "voice" | "images" | "align" | "render";

export type StageReport = {
  stage: StageName;
  status: "ok" | "skipped" | "failed";
  durationMs: number;
  attempts: number;
  units?: Record<string, number | string>;
  error?: string;
};

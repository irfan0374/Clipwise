import { z } from "zod";
import { Formats, LengthModes } from "../enums";

export const Id = z.string().regex(/^[a-f0-9]{24}$/); // Mongo ObjectId
export const LengthMode = z.enum(LengthModes);
export const Format = z.enum(Formats);
export const Topic = z.string().trim().min(3).max(300);
export const Cursor = z.object({
  before: z.iso.datetime().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

/** ElevenLabs default voices that work on the free plan. The UI shows names, the API sends IDs. */
export const Voices = [
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
] as const;
type VoiceIdValue = (typeof Voices)[number]["id"];
export const VoiceId = z.enum(Voices.map((v) => v.id) as [VoiceIdValue, ...VoiceIdValue[]]);
export type VoiceId = z.infer<typeof VoiceId>;
export type LengthMode = z.infer<typeof LengthMode>;
export type Format = z.infer<typeof Format>;

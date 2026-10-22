import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: path.join(repoRoot, ".env"), quiet: true });

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env (see .env.example)`);
  return value;
};

export const env = {
  gemini: () => ({
    apiKey: required("GEMINI_API_KEY"),
    // Comma-separated, tried in order. Each model has its own free daily quota, so later ones take over when one runs out.
    models: (process.env.GEMINI_MODEL || "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash-lite,gemini-2.5-flash")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
  }),
  elevenLabs: () => ({
    apiKey: required("ELEVENLABS_API_KEY"),
    voiceId: required("ELEVENLABS_VOICE_ID"),
    modelDraft: process.env.ELEVENLABS_MODEL_DRAFT || "eleven_flash_v2_5",
    modelFinal: process.env.ELEVENLABS_MODEL_FINAL || "eleven_multilingual_v2",
    // The pipeline refuses to start a voiceover that would go past this (free plan: 10,000 a month).
    monthlyCredits: Number(process.env.ELEVENLABS_MONTHLY_CREDITS || 10_000),
  }),
  imageKeys: () => ({ pexels: process.env.PEXELS_API_KEY || undefined, pixabay: process.env.PIXABAY_API_KEY || undefined }),
};

/** Lists every missing key a run needs, so the CLI can stop before creating a run folder. */
export const missingKeys = ({ dryRun = false } = {}) => {
  const needed = dryRun
    ? ["GEMINI_API_KEY"]
    : ["GEMINI_API_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"];
  return needed.filter((name) => !process.env[name]);
};

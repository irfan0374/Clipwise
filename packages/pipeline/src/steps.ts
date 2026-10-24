// The pipeline's decision logic, free of storage: each step takes data, calls the providers and returns data.
// The CLI (run.ts) saves results to out/; the worker saves them to MongoDB and object storage.
// Provider calls are injectable so tests never spend credits.

import type { VideoFormat } from "./formats";
import { estimateAlignment, lengthVerdict, spokenSeconds } from "./stages/align";
import {
  type Claim,
  type FactCheck,
  factCheck,
  factFeedback,
  issuesOf,
  removeDoubtfulNumbers,
} from "./stages/factcheck";
import { generateScript, type ScriptAttempt } from "./stages/script";
import { fixUnknownIcons, narrationWords, type ValidationResult, validateScript } from "./stages/validate";
import { generateVoice, narrationText, type VoiceResult } from "./stages/voice";
import { type Alignment, type Length, lengthRules, type Script } from "./types";
import { creditsFor } from "./usage";

export const MAX_SCRIPT_ATTEMPTS = 4;
export const MAX_FACT_REWRITES = 2;

export type Log = (message: string) => void;
const quiet: Log = () => {};

export type Providers = {
  generateScript: typeof generateScript;
  factCheck: typeof factCheck;
  generateVoice: typeof generateVoice;
};
const real: Providers = { generateScript, factCheck, generateVoice };

export class ScriptFailedError extends Error {
  constructor(
    readonly invalid: { raw: unknown; errors: string[] }[],
    readonly tokens: number,
    readonly requests: number,
  ) {
    // The reasons go into the run report (admin only); users see a friendly message instead.
    super(
      `Gemini did not produce a valid script in ${MAX_SCRIPT_ATTEMPTS} attempts: ${invalid
        .map((a, i) => `#${i + 1} ${a.errors.join("; ")}`)
        .join(" | ")
        .slice(0, 1500)}`,
    );
  }
}

const letters = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** A quote-format topic that is a saying itself (not a theme like "quotes about patience"). */
export const quoteFromTopic = (topic: string, format: VideoFormat) =>
  format === "quote" && !/^\s*(quotes?|sayings?|proverbs?)\b/i.test(topic) && letters(topic).split(" ").length >= 3
    ? topic.trim().replace(/^["“'‘]+|["”'’]+$/g, "")
    : null;

/** For a quote video whose topic is the saying, the hook must say it word for word. */
const withQuoteRule = (checked: ValidationResult, topic: string, format: VideoFormat): ValidationResult => {
  const quote = quoteFromTopic(topic, format);
  if (!quote) return checked;
  const script = checked.ok ? checked.script : checked.lengthOnly?.script;
  if (!script || letters(script.scenes[0]?.narration ?? "").includes(letters(quote))) return checked;
  const error = `Use the quote "${quote}" word for word as scene 0's narration and as the title scene's on-screen text.`;
  return checked.ok
    ? { ok: false, errors: [error] }
    : { ...checked, errors: [...checked.errors, error], lengthOnly: undefined };
};

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Feedback that returns the previous script with per-scene word counts, to be edited rather than redone. */
export const lengthFixup = (script: Script) =>
  [
    "Edit your previous script below instead of starting over. Keep the title, hook, cta, templates, visuals and on-screen text of the scenes you keep; lengthen or shorten the narration and, only if asked above, add or remove scenes so the size is right (the hook stays the first scene's narration and the cta stays at the end of the last one; renumber scene indexes from 0).",
    `Current words per scene: ${script.scenes.map((s) => `scene ${s.index}: ${countWords(s.narration)}`).join(", ")}.`,
    `Previous script: ${JSON.stringify(script)}`,
  ].join("\n");

export type ScriptResult = {
  script: Script;
  attempts: number;
  /** Gemini API calls made, retries included (for the daily request budget). */
  requests: number;
  tokens: number;
  model: string;
  /** Invalid replies before the valid one, with their validation errors. */
  invalid: { raw: unknown; errors: string[] }[];
};

/** Gemini script, validated with Zod; invalid replies are retried with the errors as feedback. */
export async function writeScript(
  opts: { topic: string; length: Length; format?: VideoFormat; feedback?: string[]; images?: boolean; log?: Log },
  providers: Providers = real,
): Promise<ScriptResult> {
  const { topic, length, format = "explainer", images = false, log = quiet } = opts;
  const extra = opts.feedback ?? [];
  let feedback = extra;
  let tokens = 0;
  let requests = 0;
  const invalid: ScriptResult["invalid"] = [];
  // The attempt closest to the word budget among those where only the size was off: used as a fallback,
  // so a good script never fails only because of its length (the video runs a little shorter or longer).
  let best: { script: Script; off: number; model: string; attempt: number } | null = null;
  const target = (lengthRules[length].minWords + lengthRules[length].maxWords) / 2;
  for (let attempt = 1; attempt <= MAX_SCRIPT_ATTEMPTS; attempt++) {
    const result: ScriptAttempt = await providers.generateScript(topic, length, feedback, { images, format });
    tokens += result.tokens;
    requests += result.attempts;
    const checked = withQuoteRule(validateScript(result.raw, length, { images }), topic, format);
    if (checked.ok) {
      for (const repair of checked.repairs) log(`repaired ${repair}`);
      const replaced = fixUnknownIcons(checked.script);
      if (replaced.length) log(`unknown icons replaced with "sparkles": ${replaced.join(", ")}`);
      return { script: checked.script, attempts: attempt, requests, tokens, model: result.model, invalid };
    }
    log(`attempt ${attempt} invalid: ${checked.errors.join(" | ")}`);
    invalid.push({ raw: result.raw, errors: checked.errors });
    if (checked.lengthOnly) {
      const off = Math.abs(narrationWords(checked.lengthOnly.script) - target) / target;
      if (!best || off < best.off) best = { script: checked.lengthOnly.script, off, model: result.model, attempt };
    }
    // Only the length is off: hand the script back to be lengthened/shortened instead of rewritten from scratch
    // (a fresh attempt tends to repeat the same word count).
    feedback = checked.lengthOnly
      ? [...extra, ...checked.errors, lengthFixup(checked.lengthOnly.script)]
      : [...extra, ...checked.errors];
  }
  if (best) {
    log(`no attempt hit the word budget; keeping attempt ${best.attempt} (${narrationWords(best.script)} words)`);
    fixUnknownIcons(best.script);
    return { script: best.script, attempts: MAX_SCRIPT_ATTEMPTS, requests, tokens, model: best.model, invalid };
  }
  throw new ScriptFailedError(invalid, tokens, requests);
}

export type FactCheckResult = {
  /** The script after any fact-check rewrites and number removal. */
  script: Script;
  scriptChanged: boolean;
  check: FactCheck;
  rewrites: number;
  fixed: Claim[];
  remaining: Claim[];
  unsure: Claim[];
  numbersRemovedFromScenes: number[];
  /** Scenes whose text changed (rewrites or number removal). */
  changedScenes: number[];
  factcheckTokens: number;
  /** Tokens spent on rewrites (script calls). */
  scriptTokens: number;
  requests: number;
  rewriteModel: string | null;
};

/** JSON with sorted keys, so validation's key order doesn't count as a change. */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );

const sceneDiff = (a: Script, b: Script) =>
  b.scenes.filter((s, i) => stable(s) !== stable(a.scenes[i])).map((s) => s.index);

/** Checks every claim; wrong or imprecise ones trigger up to two rewrites, then doubtful numbers are removed. */
export async function checkFacts(
  opts: { script: Script; topic: string; length: Length; format?: VideoFormat; images?: boolean; log?: Log },
  providers: Providers = real,
): Promise<FactCheckResult> {
  const { topic, length, format = "explainer", images = false, log = quiet } = opts;
  const original = opts.script;
  let script = structuredClone(original);
  let check = await providers.factCheck(script, { brief: topic, format });
  let factcheckTokens = check.tokens;
  let scriptTokens = 0;
  let requests = 1;
  let rewrites = 0;
  let rewriteModel: string | null = null;
  const fixed: Claim[] = [];
  while (issuesOf(check).length && rewrites < MAX_FACT_REWRITES) {
    const issues = issuesOf(check);
    for (const c of issues) log(`✗ scene ${c.scene}: "${c.text}" (${c.verdict}) → ${c.fix || "remove"}`);
    fixed.push(...issues);
    const rewritten = await writeScript(
      { topic, length, format, feedback: factFeedback(issues), images, log },
      providers,
    );
    script = rewritten.script;
    scriptTokens += rewritten.tokens;
    requests += rewritten.requests;
    rewriteModel = rewritten.model;
    rewrites++;
    check = await providers.factCheck(script, { brief: topic, format });
    factcheckTokens += check.tokens;
    requests++;
  }
  const remaining = issuesOf(check);
  const numbersRemovedFromScenes = removeDoubtfulNumbers(script, remaining);
  if (numbersRemovedFromScenes.length)
    log(`removed doubtful numbers from scenes ${numbersRemovedFromScenes.join(", ")}`);
  const unsure = check.claims.filter((c) => c.verdict === "unsure");
  const changedScenes = sceneDiff(original, script);
  return {
    script,
    scriptChanged: stable(original) !== stable(script),
    check,
    rewrites,
    fixed,
    remaining,
    unsure,
    numbersRemovedFromScenes,
    changedScenes,
    factcheckTokens,
    scriptTokens,
    requests,
    rewriteModel,
  };
}

/** Credits a voiceover of this script will cost (used for the budget check before recording). */
export const estimateVoiceCredits = (script: Script, model: string) => creditsFor(narrationText(script).length, model);

export type VoiceStepResult = {
  audio: Buffer;
  alignment: Alignment;
  characters: number;
  credits: number;
  model: string;
  seconds: number;
  speed: number;
  attempts: number;
};

const clampSpeed = (speed: number) => Math.min(1.2, Math.max(0.8, Number(speed.toFixed(2))));

/**
 * One ElevenLabs take for the whole narration. If it's off the target length, it is re-recorded once at a
 * corrected speed (0.8–1.2x) and that take is kept. The script is never rewritten here, so what is voiced
 * is always the fact-checked script.
 */
export async function recordVoice(
  opts: { script: Script; length: Length; final?: boolean; voiceId?: string; log?: Log },
  providers: Providers = real,
): Promise<VoiceStepResult> {
  const { script, length, final = false, voiceId, log = quiet } = opts;
  let characters = 0;
  let credits = 0;
  let attempts = 0;
  let speed = 1;
  for (let take = 1; ; take++) {
    const voice: VoiceResult = await providers.generateVoice(narrationText(script), { final, speed, voiceId });
    attempts += voice.attempts;
    characters += voice.characters;
    credits += creditsFor(voice.characters, voice.model);
    const seconds = spokenSeconds(voice.alignment);
    const verdict = lengthVerdict(seconds, length);
    log(`${seconds.toFixed(1)}s spoken (target ${length}s) → ${verdict.action === "accept" ? "accept" : `off target`}`);
    if (verdict.action === "accept" || take === 2) {
      if (verdict.action !== "accept") log("still off target after a speed correction; keeping this take");
      return {
        audio: voice.audio,
        alignment: voice.alignment,
        characters,
        credits,
        model: voice.model,
        seconds: Number(seconds.toFixed(2)),
        speed,
        attempts,
      };
    }
    // Faster when too long, slower when too short (ElevenLabs allows 0.7–1.2; we stay within 0.8–1.2).
    speed = clampSpeed(verdict.action === "adjustSpeed" ? verdict.speed : seconds / length);
  }
}

/** Silent preview timing: estimated from the narration at 2.5 words per second, no credits. */
export const previewAlignment = (script: Script) => estimateAlignment(narrationText(script));

export type RecheckResult = { claims: Claim[]; tokens: number; model: string };

/**
 * Fact-checks only the given scenes (after the user edited them). Nothing is rewritten: the words are the
 * user's, so wrong or doubtful claims become notes to review. Claims keep their scene index.
 */
export async function recheckScenes(
  opts: { script: Script; scenes: number[]; topic: string; format?: VideoFormat },
  providers: Providers = real,
): Promise<RecheckResult> {
  const wanted = new Set(opts.scenes);
  const partial = { ...opts.script, scenes: opts.script.scenes.filter((s) => wanted.has(s.index)) };
  if (!partial.scenes.length) return { claims: [], tokens: 0, model: "" };
  const check = await providers.factCheck(partial, { brief: opts.topic, format: opts.format ?? "explainer" });
  return { claims: check.claims.filter((c) => wanted.has(c.scene)), tokens: check.tokens, model: check.model };
}

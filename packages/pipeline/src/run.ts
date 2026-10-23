import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Timeline } from "@clipwise/video";
import { env, repoRoot } from "./env";
import { FatalError } from "./retry";
import { buildTimeline, estimateAlignment, spokenSeconds } from "./stages/align";
import { fetchImages, type ImagesResult, imageProvider } from "./stages/images";
import { renderVideo } from "./stages/render";
import { narrationText } from "./stages/voice";
import { checkFacts, recordVoice, ScriptFailedError, writeScript as writeScriptStep } from "./steps";
import type { Alignment, Length, Script, StageName, StageReport } from "./types";
import { creditsFor, monthUsage, recordUsage } from "./usage";

const warn = (message: string) => console.warn(`  ${message}`);

export type RunMeta = { topic: string; length: Length; final: boolean; createdAt: string };

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join("-");

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  );
const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8")) as T;
const writeJson = (file: string, data: unknown) => writeFile(file, JSON.stringify(data, null, 2));

/** Creates out/{date-time}-{topic-slug}/ with meta.json. */
export const createRun = async (topic: string, length: Length, final = false) => {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const runDir = path.join(repoRoot, "out", `${stamp}-${slugify(topic)}`);
  await mkdir(path.join(runDir, "media"), { recursive: true });
  await writeJson(path.join(runDir, "meta.json"), {
    topic,
    length,
    final,
    createdAt: new Date().toISOString(),
  } satisfies RunMeta);
  return runDir;
};

/**
 * Runs every stage whose output is missing from runDir, so a failed or edited run resumes without paying twice.
 * Delete a stage's output file to force it to re-run. Render always re-runs (it's free).
 */
export const runPipeline = async (
  runDir: string,
  { dryRun = false, preview = false, final }: { dryRun?: boolean; preview?: boolean; final?: boolean } = {},
) => {
  const meta = await readJson<RunMeta>(path.join(runDir, "meta.json"));
  const useFinalVoice = final ?? meta.final;
  const files = {
    script: path.join(runDir, "script.json"),
    factcheck: path.join(runDir, "factcheck.json"),
    voice: path.join(runDir, "media/voice.mp3"),
    alignment: path.join(runDir, "alignment.json"),
    images: path.join(runDir, "images.json"),
    timeline: path.join(runDir, "timeline.json"),
    video: path.join(runDir, preview ? "preview.mp4" : "final.mp4"),
    report: path.join(runDir, "run.json"),
  };

  // Without an image provider, Gemini is told not to plan photo scenes.
  const images = imageProvider() !== null;
  const reports: StageReport[] = [];
  const startedAt = Date.now();
  const saveReport = (status: "ok" | "failed" | "dry-run") =>
    writeJson(preview ? path.join(runDir, "run.preview.json") : files.report, {
      ...meta,
      runDir,
      status,
      totalMs: Date.now() - startedAt,
      stages: reports,
    });

  const stage = async <T>(
    name: StageName,
    fn: () => Promise<{ value: T; attempts?: number; units?: StageReport["units"]; skipped?: boolean }>,
  ) => {
    const t0 = Date.now();
    console.log(`→ ${name}`);
    try {
      const result = await fn();
      reports.push({
        stage: name,
        status: result.skipped ? "skipped" : "ok",
        durationMs: Date.now() - t0,
        attempts: result.attempts ?? (result.skipped ? 0 : 1),
        units: result.units,
      });
      console.log(`  ${result.skipped ? "reused saved output" : "done"} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      return result.value;
    } catch (error) {
      reports.push({
        stage: name,
        status: "failed",
        durationMs: Date.now() - t0,
        attempts: 0,
        error: (error as Error).message,
      });
      await saveReport("failed");
      throw error;
    }
  };

  // Script: Gemini, validated, retried with the validation errors as feedback (steps.ts).
  const writeScript = async (extraFeedback: string[] = []) => {
    try {
      const result = await writeScriptStep(
        { topic: meta.topic, length: meta.length, feedback: extraFeedback, images, log: warn },
        undefined,
      );
      for (const [i, bad] of result.invalid.entries()) {
        await writeJson(path.join(runDir, `script.invalid-${i + 1}.json`), bad);
      }
      await writeJson(files.script, result.script);
      await recordUsage({ geminiTokens: result.tokens });
      return {
        value: result.script,
        attempts: result.attempts,
        units: { geminiTokens: result.tokens, model: result.model },
      };
    } catch (error) {
      if (!(error instanceof ScriptFailedError)) throw error;
      for (const [i, bad] of error.invalid.entries()) {
        await writeJson(path.join(runDir, `script.invalid-${i + 1}.json`), bad);
      }
      await recordUsage({ geminiTokens: error.tokens });
      throw new Error(`${error.message} (see script.invalid-*.json)`);
    }
  };

  let script = await stage("script", async () =>
    (await exists(files.script)) ? { value: await readJson<Script>(files.script), skipped: true } : writeScript(),
  );

  // Fact-check: verify every claim; rewrite up to twice with the corrections, then strip doubtful numbers (steps.ts).
  await stage("factcheck", async () => {
    if (await exists(files.factcheck)) return { value: null, skipped: true };
    const result = await checkFacts({ script, topic: meta.topic, length: meta.length, images, log: warn });
    script = result.script;
    if (result.scriptChanged) await writeJson(files.script, script);
    for (const c of [...result.remaining, ...result.unsure])
      console.warn(`  ⚠ check manually, scene ${c.scene}: "${c.text}" (${c.verdict})`);
    await writeJson(files.factcheck, {
      ...result.check,
      rewrites: result.rewrites,
      fixedIssues: result.fixed,
      remainingIssues: result.remaining,
      numbersRemovedFromScenes: result.numbersRemovedFromScenes,
    });
    await recordUsage({ geminiTokens: result.factcheckTokens + result.scriptTokens });
    console.log(
      `  ${result.check.claims.length} claims checked${result.check.searched ? " with Google Search" : ""}; ${result.rewrites} rewrite(s), ${result.remaining.length + result.unsure.length} to check manually`,
    );
    return {
      value: null,
      units: {
        claims: result.check.claims.length,
        rewrites: result.rewrites,
        remaining: result.remaining.length,
        unsure: result.unsure.length,
        numbersRemoved: result.numbersRemovedFromScenes.length,
        searched: String(result.check.searched),
      },
    };
  });

  if (dryRun) {
    await saveReport("dry-run");
    return { runDir, script };
  }

  // Voice: one ElevenLabs take for the whole narration, kept on target length.
  // Previews skip it and estimate the timing instead, so they cost no credits.
  const alignment = await stage("voice", async () => {
    if (preview) {
      const value = estimateAlignment(narrationText(script));
      console.log(`  preview: no voice, estimated ${spokenSeconds(value).toFixed(1)}s of narration`);
      return { value, units: { credits: 0, estimatedSeconds: Number(spokenSeconds(value).toFixed(1)) } };
    }
    if ((await exists(files.voice)) && (await exists(files.alignment))) {
      return { value: await readJson<Alignment>(files.alignment), skipped: true };
    }
    // Credit guard: refuse to start if this take could push the month past the plan's credits.
    const { monthlyCredits, modelDraft, modelFinal } = env.elevenLabs();
    const estimate = creditsFor(narrationText(script).length, useFinalVoice ? modelFinal : modelDraft);
    const used = (await monthUsage()).elevenLabsCredits;
    if (used + estimate > monthlyCredits) {
      throw new FatalError(
        `This voiceover needs about ${estimate} ElevenLabs credits but only ${monthlyCredits - used} of ${monthlyCredits} are left this month. Use --preview for a free silent version.`,
      );
    }
    const voice = await recordVoice({
      script,
      length: meta.length,
      final: useFinalVoice,
      log: (m) => console.log(`  ${m}`),
    });
    await writeFile(files.voice, voice.audio);
    await writeJson(files.alignment, voice.alignment);
    const month = await recordUsage({ elevenLabsCharacters: voice.characters, elevenLabsCredits: voice.credits });
    console.log(`  ElevenLabs: ${voice.credits} credits this run, ${month.elevenLabsCredits} this month`);
    return {
      value: voice.alignment,
      attempts: voice.attempts,
      units: {
        characters: voice.characters,
        credits: voice.credits,
        model: voice.model,
        seconds: voice.seconds,
        speed: voice.speed,
      } as StageReport["units"],
    };
  });

  // Images: Pexels photos for imageFocus scenes.
  const sceneImages = await stage("images", async () => {
    if (await exists(files.images)) return { value: await readJson<ImagesResult>(files.images), skipped: true };
    const result = await fetchImages(script, path.join(runDir, "media"));
    await writeJson(files.images, result);
    await recordUsage({ imageRequests: result.requests });
    if (result.missing.length)
      console.warn(`  no photo for scenes ${result.missing.join(", ")}; they fall back to bullets`);
    return {
      value: result,
      units: {
        provider: result.provider ?? "none",
        found: result.images.length,
        missing: result.missing.length,
        requests: result.requests,
      },
    };
  });

  // Align: always recomputed; it's instant and picks up any script or image change.
  const timeline = await stage("align", async () => {
    const value: Timeline = buildTimeline({
      script,
      alignment,
      audioFile: preview ? null : "voice.mp3",
      imageFiles: Object.fromEntries(sceneImages.images.map((img) => [img.sceneIndex, img.file])),
    });
    await writeJson(files.timeline, value);
    return { value, units: { frames: value.durationInFrames, scenes: value.scenes.length, words: value.words.length } };
  });

  await stage("render", async () => {
    // Retry once: Remotion's local server occasionally fails to start on the first try.
    for (let attempt = 1; ; attempt++) {
      try {
        await renderVideo(timeline, path.join(runDir, "media"), files.video);
        return { value: null, attempts: attempt, units: { file: path.relative(repoRoot, files.video) } };
      } catch (error) {
        if (attempt >= 2) throw error;
        console.warn(`  render failed (${(error as Error).message}); retrying once`);
      }
    }
  });

  await saveReport("ok");
  return { runDir, script, timeline, video: files.video };
};

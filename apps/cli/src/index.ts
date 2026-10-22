import { Command, InvalidArgumentError } from "commander";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Lengths, createRun, missingKeys, repoRoot, runPipeline, type Length } from "@clipwise/pipeline";

/** Script-only and preview runs need just Gemini; full runs also need ElevenLabs. */
const requireKeys = (geminiOnly = false) => {
  const missing = missingKeys({ dryRun: geminiOnly });
  if (missing.length) {
    throw new Error(`Add these to ${path.join(repoRoot, ".env")} first: ${missing.join(", ")}`);
  }
};

const parseLength = (value: string): Length => {
  const n = Number(value);
  if (!(Lengths as readonly number[]).includes(n)) throw new InvalidArgumentError(`length must be one of ${Lengths.join(", ")}`);
  return n as Length;
};

const report = (result: Awaited<ReturnType<typeof runPipeline>>) => {
  if ("video" in result) console.log(`\n✓ ${path.relative(process.cwd(), result.video!)}`);
  else console.log(`\n${JSON.stringify(result.script, null, 2)}\n\n✓ dry run saved to ${result.runDir}`);
};

const program = new Command("clipwise").description("Turn a tech or science topic into a 9:16 explainer video");

program
  .command("make")
  .argument("<topic>", "what the video explains")
  .option("-l, --length <seconds>", "30 or 60", parseLength, 60 as Length)
  .option("--dry-run", "only write the script (no voice credits spent)")
  .option("--preview", "silent video with estimated timing (no voice credits)")
  .option("--final", "use the best ElevenLabs model instead of the cheaper draft model")
  .action(async (topic: string, opts: { length: Length; dryRun?: boolean; preview?: boolean; final?: boolean }) => {
    requireKeys(opts.dryRun || opts.preview);
    const runDir = await createRun(topic, opts.length, opts.final);
    console.log(`Run: ${path.relative(process.cwd(), runDir)}`);
    report(await runPipeline(runDir, { dryRun: opts.dryRun, preview: opts.preview }));
  });

program
  .command("resume")
  .argument("<runDir>", "a folder in out/")
  .option("--preview", "silent video with estimated timing (no voice credits)")
  .option("--final", "use the best ElevenLabs model if the voice is regenerated")
  .description("re-run only the stages whose output is missing (delete a file to redo that stage)")
  .action(async (runDir: string, opts: { preview?: boolean; final?: boolean }) => {
    requireKeys(opts.preview);
    report(await runPipeline(path.resolve(runDir), { preview: opts.preview, final: opts.final }));
  });

program
  .command("batch")
  .argument("<file>", "one topic per line, optionally 'topic | 30'")
  .option("-l, --length <seconds>", "default length", parseLength, 60 as Length)
  .option("--preview", "silent videos with estimated timing (no voice credits)")
  .option("--final", "use the best ElevenLabs model")
  .action(async (file: string, opts: { length: Length; preview?: boolean; final?: boolean }) => {
    requireKeys(opts.preview);
    const lines = (await readFile(file, "utf8")).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const failures: string[] = [];
    for (const [i, line] of lines.entries()) {
      const [topic, len] = line.split("|").map((s) => s.trim());
      console.log(`\n[${i + 1}/${lines.length}] ${topic}`);
      try {
        const runDir = await createRun(topic!, len ? parseLength(len) : opts.length, opts.final);
        report(await runPipeline(runDir, { preview: opts.preview }));
      } catch (error) {
        console.error(`✗ ${(error as Error).message}`);
        failures.push(topic!);
      }
    }
    console.log(`\n${lines.length - failures.length}/${lines.length} succeeded${failures.length ? `; failed: ${failures.join(", ")}` : ""}`);
  });

program.parseAsync().catch((error: Error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});

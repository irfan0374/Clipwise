import { describe, expect, it } from "vitest";
import type { FactCheck } from "../src/stages/factcheck";
import { narrationText } from "../src/stages/voice";
import { checkFacts, type Providers, recordVoice, ScriptFailedError, writeScript } from "../src/steps";
import { fakeAlignment, validScript, words } from "./fixtures";

const scriptReply = (raw: unknown) => ({ raw, tokens: 100, attempts: 1, model: "fake-gemini" });
const check = (claims: FactCheck["claims"]): FactCheck => ({ claims, model: "fake", searched: false, tokens: 50 });

/** Fake providers: each call takes the next queued answer. Nothing leaves the machine. */
const fakes = (opts: {
  scripts?: unknown[];
  checks?: FactCheck[];
  voiceSeconds?: number[];
}): Providers & { calls: string[] } => {
  const calls: string[] = [];
  const scripts = [...(opts.scripts ?? [])];
  const checks = [...(opts.checks ?? [])];
  const seconds = [...(opts.voiceSeconds ?? [])];
  return {
    calls,
    generateScript: async (_topic, _length, feedback) => {
      calls.push(`script${feedback?.length ? "+feedback" : ""}`);
      return scriptReply(scripts.shift());
    },
    factCheck: async () => {
      calls.push("factcheck");
      return checks.shift() ?? check([]);
    },
    generateVoice: async (text, { speed = 1 } = {}) => {
      calls.push(`voice@${speed}`);
      const target = seconds.shift() ?? 30;
      return {
        audio: Buffer.from("mp3"),
        alignment: fakeAlignment(text, target / text.length),
        characters: text.length,
        model: "eleven_flash_v2_5",
        attempts: 1,
      };
    },
  };
};

describe("writeScript", () => {
  it("retries an invalid reply with the errors as feedback", async () => {
    const p = fakes({ scripts: [{ nope: true }, validScript()] });
    const r = await writeScript({ topic: "sky", length: 30, images: true }, p);
    expect(r.attempts).toBe(2);
    expect(r.invalid).toHaveLength(1);
    expect(r.tokens).toBe(200);
    expect(p.calls).toEqual(["script", "script+feedback"]);
  });

  it("hands back a too-short script to be lengthened instead of starting over", async () => {
    const short = validScript();
    short.scenes[1]!.narration = "Too short.";
    short.scenes[3]!.narration = "Also short.";
    const feedback: string[][] = [];
    const p = fakes({ scripts: [short, validScript()] });
    const spy: Providers = {
      ...p,
      generateScript: async (topic, length, fb, opts) => {
        feedback.push(fb ?? []);
        return p.generateScript(topic, length, fb, opts);
      },
    };
    const r = await writeScript({ topic: "sky", length: 30, images: true }, spy);
    expect(r.attempts).toBe(2);
    const second = feedback[1]!.join("\n");
    expect(second).toMatch(/Add about \d+ words/);
    expect(second).toMatch(/Edit your previous script below instead of starting over/);
    expect(second).toMatch(/scene 1: 2/);
    expect(second).toContain('"narration":"Too short."');
  });

  it("keeps the closest attempt when every attempt is good except its length", async () => {
    const short = (n: number) => {
      const s = validScript();
      s.scenes[1]!.narration = words(n);
      s.scenes[3]!.narration = words(2);
      return s;
    };
    // narration totals: 42, 46, 40, 44 words (all under the 52-word floor for 30s); 46 is closest to the target
    const p = fakes({ scripts: [short(5), short(9), short(3), short(7)] });
    const r = await writeScript({ topic: "sky", length: 30, images: true }, p);
    expect(r.attempts).toBe(4);
    expect(r.invalid).toHaveLength(4);
    expect(r.script.scenes[1]!.narration.split(" ")).toHaveLength(9);
  });

  it("gives up after four invalid replies and reports what was spent", async () => {
    const p = fakes({ scripts: [{}, {}, {}, {}] });
    const err = await writeScript({ topic: "sky", length: 30 }, p).catch((e) => e);
    expect(err).toBeInstanceOf(ScriptFailedError);
    expect(err.tokens).toBe(400);
  });
});

describe("checkFacts", () => {
  it("keeps the script when every claim is correct", async () => {
    const p = fakes({ checks: [check([{ scene: 1, text: "Light scatters", verdict: "correct", fix: "" }])] });
    const r = await checkFacts({ script: validScript(), topic: "sky", length: 30, images: true }, p);
    expect(r.scriptChanged).toBe(false);
    expect(r.rewrites).toBe(0);
    expect(p.calls).toEqual(["factcheck"]);
  });

  it("rewrites on a wrong claim and never mutates the input script", async () => {
    const input = validScript();
    const before = JSON.stringify(input);
    const rewritten = validScript();
    rewritten.scenes[2]!.stat = { value: "~5x", label: "more blue scattered (fixed)" };
    const p = fakes({
      scripts: [rewritten],
      checks: [check([{ scene: 2, text: "10x more blue", verdict: "wrong", fix: "about 5x" }]), check([])],
    });
    const r = await checkFacts({ script: input, topic: "sky", length: 30, images: true }, p);
    expect(r.rewrites).toBe(1);
    expect(r.scriptChanged).toBe(true);
    expect(r.changedScenes).toEqual([2]);
    expect(JSON.stringify(input)).toBe(before);
    expect(p.calls).toEqual(["factcheck", "script+feedback", "factcheck"]);
  });
});

describe("recordVoice", () => {
  it("accepts a take on target length", async () => {
    const p = fakes({ voiceSeconds: [30] });
    const r = await recordVoice({ script: validScript(), length: 30 }, p);
    expect(r.speed).toBe(1);
    expect(r.credits).toBe(Math.ceil(narrationText(validScript()).length * 0.5));
  });

  it("re-records once at a corrected speed when 10-20% off", async () => {
    const p = fakes({ voiceSeconds: [34.5, 30] });
    const r = await recordVoice({ script: validScript(), length: 30 }, p);
    expect(p.calls).toEqual(["voice@1", "voice@1.15"]);
    expect(r.speed).toBe(1.15);
    expect(r.credits).toBe(2 * Math.ceil(narrationText(validScript()).length * 0.5));
  });

  it("never rewrites the script: far off length gets one speed correction (capped) and keeps that take", async () => {
    const p = fakes({ voiceSeconds: [45, 40] });
    const r = await recordVoice({ script: validScript(), length: 30 }, p);
    expect(p.calls).toEqual(["voice@1", "voice@1.2"]); // 1.5x needed, capped at 1.2
    expect(p.calls.some((c) => c.startsWith("script"))).toBe(false);
    expect(r.seconds).toBe(40);
  });

  it("slows down a take that is far too short", async () => {
    const p = fakes({ voiceSeconds: [20, 24] });
    await recordVoice({ script: validScript(), length: 30 }, p);
    expect(p.calls).toEqual(["voice@1", "voice@0.8"]);
  });
});

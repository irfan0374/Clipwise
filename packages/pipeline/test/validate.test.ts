import { describe, expect, it } from "vitest";
import { countWords, fixUnknownIcons, narrationWords, validateScript } from "../src/stages/validate";
import { validScript, words } from "./fixtures";

describe("validateScript", () => {
  it("accepts a script within every rule", () => {
    const script = validScript();
    expect(narrationWords(script)).toBe(70);
    expect(validateScript(script, 30)).toEqual({ ok: true, script, repairs: [] });
  });

  it("reports schema errors with paths", () => {
    const result = validateScript({ title: "x" }, 30);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.startsWith("scenes"))).toBe(true);
  });

  it("asks for a word count inside the budget", () => {
    const script = validScript();
    script.scenes[1]!.narration = words(80);
    const result = validateScript(script, 30);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        "You wrote 135 words of narration; the maximum is 80. Remove about 55 words: shorten the longest scenes.",
      );
      expect(result.lengthOnly?.script.title).toBe("Why is the sky blue?"); // only the length is wrong
    }
  });

  it("says how many words to add when a script is too short", () => {
    const script = validScript();
    script.scenes[1]!.narration = words(2);
    script.scenes[3]!.narration = words(5);
    const result = validateScript(script, 30);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatch(
        /^You wrote 47 words of narration; you need at least 65 \(aim for 80\)\. Add about 33 words/,
      );
      expect(result.lengthOnly).toBeDefined();
    }
  });

  it("accepts a slightly short script (voice speed covers the rest)", () => {
    const script = validScript();
    script.scenes[1]!.narration = words(2); // 57 words: above the 80% floor (52)
    expect(validateScript(script, 30).ok).toBe(true);
  });

  it("offers a fix-up when only the scene count is off", () => {
    const script = validScript();
    const [hook, , , middle, last] = script.scenes;
    script.lengthSeconds = 60;
    // 3 scenes with enough words for 60s: only the scene count (5–9 allowed) is wrong
    script.scenes = [
      hook!,
      { ...middle!, index: 1, narration: words(60) },
      { ...last!, index: 2, narration: `${words(60)} ${script.cta}` },
    ];
    const result = validateScript(script, 60);
    expect(!result.ok && result.errors).toEqual([expect.stringMatching(/^You wrote 3 scenes/)]);
    expect(!result.ok && result.lengthOnly).toBeTruthy();
  });

  it("does not offer a length fix-up when other rules are broken too", () => {
    const script = validScript();
    script.scenes[1]!.narration = words(2);
    script.scenes[3]!.narration = words(5);
    script.scenes[2]!.stat = { value: "Lots", label: "no digit" }; // a real rule break, not just size
    const result = validateScript(script, 30);
    expect(!result.ok && result.lengthOnly).toBeFalsy();
  });

  it("repairs lengthSeconds to the length requested instead of rejecting", () => {
    const script = validScript();
    script.lengthSeconds = 60;
    const result = validateScript(script, 30);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.script.lengthSeconds).toBe(30);
      expect(result.repairs).toContain("lengthSeconds set to 30");
    }
  });

  it("requires imageQuery for imageFocus and stat for stat scenes", () => {
    const script = validScript();
    delete script.scenes[1]!.imageQuery;
    delete script.scenes[2]!.stat;
    const result = validateScript(script, 30);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("scenes[1] is imageFocus but has no imageQuery.");
      expect(result.errors).toContain("scenes[2] is stat but has no stat.");
    }
  });

  it("syncs the hook with scene 1 and takes the cta from the last scene", () => {
    const script = validScript();
    script.scenes[0]!.narration = "Something else entirely here.";
    script.scenes[4]!.narration = `${words(14, "d")}. Save this for later!`;
    const result = validateScript(script, 30);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.script.hook).toBe("Something else entirely here.");
      expect(result.script.cta).toBe("Save this for later!");
      expect(result.repairs).toEqual(
        expect.arrayContaining(["hook synced to scene 1", "cta taken from the last scene"]),
      );
    }
  });

  it("limits on-screen lines to eight words", () => {
    const script = validScript();
    script.scenes[3]!.onScreenText = ["one two three four five six seven eight nine"];
    const result = validateScript(script, 30);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("scenes[3].onScreenText[0] has more than 8 words; keep it to 6.");
  });

  it("requires short numeric stat values", () => {
    const script = validScript();
    script.scenes[2]!.stat = { value: "Billions", label: "switches" };
    const result = validateScript(script, 30);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toContain(
        'scenes[2].stat.value "Billions" must contain a digit and be at most 6 characters.',
      );
  });

  it("counts words on any whitespace", () => {
    expect(countWords("  a\tb\n c  ")).toBe(3);
  });
});

describe("validateScript without images", () => {
  it("rejects imageFocus scenes when no photo provider is set", () => {
    const result = validateScript(validScript(), 30, { images: false });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toContain("scenes[1] uses imageFocus, which is not available; use another template.");
  });
});

describe("visuals", () => {
  const ok = (script: ReturnType<typeof validScript>) => {
    const result = validateScript(script, 30);
    if (!result.ok) throw new Error(result.errors.join("; "));
    return result;
  };

  it("adds an icon when a scene has no visual", () => {
    const script = validScript();
    delete script.scenes[3]!.visual;
    const result = ok(script);
    expect(result.script.scenes[3]!.visual).toEqual({ type: "icon", icon: "sparkles" });
    expect(result.repairs).toEqual(["scene 3: no visual, used a sparkles icon"]);
  });

  it("falls back to a single icon when a visual is incomplete", () => {
    const script = validScript();
    script.scenes[4]!.visual = {
      type: "cycle",
      color: "green",
      items: [{ icon: "sun" }, { icon: "leaf", label: "Autumn" }],
    };
    const result = ok(script);
    expect(result.script.scenes[4]!.visual).toEqual({ type: "icon", icon: "sun", color: "green" });
  });

  it("fixes small problems in place", () => {
    const script = validScript();
    script.scenes[3]!.visual = { type: "particles" };
    script.scenes[4]!.visual = {
      type: "flow",
      items: [
        { icon: "sun", label: "A very long label indeed" },
        { icon: "eye", label: "Eye" },
        { icon: "a", label: "b" },
        { icon: "c", label: "d" },
        { icon: "e", label: "f" },
      ],
    };
    const result = ok(script);
    expect(result.script.scenes[3]!.visual!.motion).toBe("scatter");
    expect(result.script.scenes[4]!.visual!.items).toHaveLength(4);
    expect(result.script.scenes[4]!.visual!.items![0]!.label).toBe("A very long label");
  });

  it("removes visuals from stat scenes", () => {
    const script = validScript();
    script.scenes[2]!.visual = { type: "icon", icon: "sun" };
    expect(ok(script).script.scenes[2]!.visual).toBeUndefined();
  });

  it("swaps unknown icons for sparkles", () => {
    const script = validScript();
    script.scenes[0]!.visual = { type: "icon", icon: "not-a-real-icon" };
    expect(fixUnknownIcons(script)).toEqual(["not-a-real-icon"]);
    expect(script.scenes[0]!.visual!.icon).toBe("sparkles");
  });
});

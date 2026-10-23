import { describe, expect, it } from "vitest";
import { type Claim, factFeedback, issuesOf, readClaims, removeDoubtfulNumbers } from "../src/stages/factcheck";
import { validScript } from "./fixtures";

const claim = (verdict: Claim["verdict"], fix = ""): Claim => ({
  scene: 3,
  text: "Blue scatters 10x more than red",
  verdict,
  fix,
});

describe("fact-check helpers", () => {
  it("treats wrong and imprecise claims as issues, not correct or unsure ones", () => {
    const claims = [claim("correct"), claim("imprecise", "about 5.5x"), claim("wrong", "x"), claim("unsure")];
    expect(issuesOf({ claims }).map((c) => c.verdict)).toEqual(["imprecise", "wrong"]);
  });

  it("writes feedback the script writer can act on", () => {
    const feedback = factFeedback([claim("imprecise", "about 5x"), claim("wrong")]);
    expect(feedback[0]).toBe(
      'Fact error in scene 3: "Blue scatters 10x more than red" is imprecise. Replace it with: "about 5x".',
    );
    expect(feedback[1]).toBe('Fact error in scene 3: "Blue scatters 10x more than red" is wrong. Remove it.');
    expect(feedback).toHaveLength(3);
  });
});

describe("removeDoubtfulNumbers", () => {
  it("turns a doubtful stat scene into bullets and a doubtful bar chart into an icon", () => {
    const script = validScript();
    script.scenes[3]!.visual = {
      type: "bars",
      items: [
        { label: "Blue", value: 10 },
        { label: "Red", value: 1, icon: "sun" },
      ],
    };
    const changed = removeDoubtfulNumbers(script, [
      { ...claim("wrong"), scene: 2 },
      { ...claim("wrong"), scene: 3 },
      { ...claim("wrong"), scene: 1 },
    ]);
    expect(changed).toEqual([2, 3]);
    expect(script.scenes[2]!.template).toBe("bullets");
    expect(script.scenes[2]!.stat).toBeUndefined();
    expect(script.scenes[3]!.visual).toEqual({ type: "icon", icon: "sun" });
    expect(script.scenes[1]!.template).toBe("imageFocus");
  });
});

describe("readClaims", () => {
  it("accepts renamed fields, string scenes and capitalised verdicts, and skips unusable claims", () => {
    const claims = readClaims({
      claims: [
        { scene: 1, text: "Cats purr at 25 Hz", verdict: "correct", fix: "" },
        { scene: "2", claim: "Purring heals bones", verdict: "Unsure" },
        { scene: 3, verdict: "correct" }, // no text: skipped
        { scene: 4, text: "x", verdict: "maybe" }, // unknown verdict: skipped
        "noise",
      ],
    });
    expect(claims).toEqual([
      { scene: 1, text: "Cats purr at 25 Hz", verdict: "correct", fix: "" },
      { scene: 2, text: "Purring heals bones", verdict: "unsure", fix: "" },
    ]);
  });

  it("accepts a bare array, and rejects a reply without any claims list", () => {
    expect(readClaims([{ scene: 0, text: "a", verdict: "wrong", fix: "b" }])).toHaveLength(1);
    expect(() => readClaims({ result: "ok" })).toThrow(/no claims list/);
  });
});

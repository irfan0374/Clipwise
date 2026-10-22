import { describe, expect, it } from "vitest";
import { type Claim, factFeedback, issuesOf, removeDoubtfulNumbers } from "../src/stages/factcheck";
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

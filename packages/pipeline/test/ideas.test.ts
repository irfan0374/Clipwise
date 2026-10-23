import { describe, expect, it } from "vitest";
import { readIdeas } from "../src/stages/ideas";

describe("readIdeas", () => {
  it("keeps usable ideas, normalises lengths and skips broken ones", () => {
    const ideas = readIdeas({
      ideas: [
        {
          title: "3 stretches that fix desk-job back pain",
          hook: "Your chair is wrecking your back.",
          suggestedLength: "30",
        },
        { title: "Why muscles get sore two days later", hook: "It's not lactic acid.", suggestedLength: "60s" },
        { title: "Is creatine safe?", suggestedLength: 45 },
        { title: "" },
        "noise",
      ],
    });
    expect(ideas.map((i) => i.suggestedLength)).toEqual(["30", "60", "60"]);
    expect(ideas[2]?.hook).toBe("");
    expect(ideas).toHaveLength(3);
  });

  it("rejects a reply with no usable ideas", () => {
    expect(() => readIdeas({ ideas: [{ title: "" }] })).toThrow(/no usable ideas/);
    expect(() => readIdeas({ nope: true })).toThrow(/no ideas list/);
  });
});

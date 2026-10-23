import { describe, expect, it } from "vitest";
import { autoLength } from "../src/formats";
import { buildPrompt } from "../src/stages/script";
import { quoteFromTopic, writeScript } from "../src/steps";
import { validScript } from "./fixtures";

describe("formats", () => {
  it("puts the format's structure and call to action into the script prompt", async () => {
    const promo = await buildPrompt("Launch video for our new running shoes", 30, [], { format: "promo" });
    expect(promo).toContain("Format: promo");
    expect(promo).toMatch(/Never invent prices, discounts, ratings/);
    expect(promo).toMatch(/Tap the link/);
    const tips = await buildPrompt("Sleep better", 30, [], { format: "tips" });
    expect(tips).toMatch(/numbered, practical tip/);
    expect(tips).not.toMatch(/Never invent prices/);
  });

  it("chooses 30s for short formats and 60s for formats that need room", () => {
    expect([autoLength("promo"), autoLength("tips"), autoLength("quote")]).toEqual([30, 30, 30]);
    expect([autoLength("explainer"), autoLength("story"), autoLength("recap")]).toEqual([60, 60, 60]);
  });
});

describe("quote format", () => {
  it("treats a saying as the quote, but not a theme", () => {
    expect(quoteFromTopic("Small steps every day beat big plans you never start", "quote")).toBe(
      "Small steps every day beat big plans you never start",
    );
    expect(quoteFromTopic("Quotes about patience", "quote")).toBeNull();
    expect(quoteFromTopic("Small steps every day", "tips")).toBeNull();
  });

  it("sends a script back when the hook doesn't say the quote word for word", async () => {
    const quote = "Small steps every day beat big plans you never start";
    const generic = validScript();
    const withQuote = validScript();
    withQuote.scenes[0]!.narration = `${quote}.`;
    withQuote.hook = `${quote}.`;
    const feedback: string[][] = [];
    const replies = [generic, withQuote];
    const r = await writeScript(
      { topic: quote, length: 30, format: "quote", images: true },
      {
        generateScript: async (_t, _l, fb) => {
          feedback.push(fb ?? []);
          return { raw: replies.shift(), tokens: 1, attempts: 1, model: "fake" };
        },
        factCheck: async () => ({ claims: [], model: "fake", searched: false, tokens: 0 }),
        generateVoice: async () => {
          throw new Error("unused");
        },
      },
    );
    expect(r.attempts).toBe(2);
    expect(feedback[1]?.join(" ")).toMatch(/word for word/);
    expect(r.script.hook).toContain("Small steps every day");
  });
});

import type { Alignment, Script } from "../src/types";

export const words = (n: number, prefix = "word") => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");

/** A valid 30s script: 5 scenes, 70 narration words. */
export const validScript = (): Script => {
  const hook = "Why is the sky blue when sunlight is white?";
  const cta = "Follow for more science in 30 seconds.";
  return {
    title: "Why is the sky blue?",
    lengthSeconds: 30,
    hook,
    scenes: [
      {
        index: 0,
        template: "title",
        narration: hook,
        onScreenText: ["Why is the sky blue?"],
        visual: { type: "icon", icon: "sun" },
      },
      {
        index: 1,
        template: "imageFocus",
        imageQuery: "sunlight through clouds",
        narration: words(15, "a"),
        onScreenText: ["Light hits air"],
      },
      {
        index: 2,
        template: "stat",
        stat: { value: "~5x", label: "more blue scattered" },
        narration: words(15, "b"),
        onScreenText: ["Blue scatters most"],
      },
      {
        index: 3,
        template: "bullets",
        narration: words(15, "c"),
        onScreenText: ["Blue comes from everywhere"],
        visual: { type: "particles", motion: "scatter" },
      },
      {
        index: 4,
        template: "bullets",
        narration: `${words(9, "d")} ${cta}`,
        onScreenText: ["Sky looks blue"],
        visual: {
          type: "flow",
          items: [
            { icon: "sun", label: "Sunlight" },
            { icon: "eye", label: "Your eyes" },
          ],
        },
      },
    ],
    cta,
  };
};

/** Fake ElevenLabs alignment: each character takes `charSeconds`, spaces included. */
export const fakeAlignment = (text: string, charSeconds = 0.05): Alignment => {
  const characters = [...text];
  return {
    characters,
    characterStartTimesSeconds: characters.map((_, i) => i * charSeconds),
    characterEndTimesSeconds: characters.map((_, i) => (i + 1) * charSeconds),
  };
};

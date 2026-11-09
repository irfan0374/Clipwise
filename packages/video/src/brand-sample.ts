import type { BrandStyle, Timeline, TimelineScene } from "./types";

// The short silent clip on the Brand kit page: a hook, a stat, a visual and the call-to-action, so every Brand kit
// choice (colours, font, title casing, captions, logo) shows up within a few seconds.

const SCENE = 75;
const scenes: (Omit<TimelineScene, "index" | "startFrame" | "endFrame"> & { narration: string })[] = [
  {
    template: "title",
    onScreenText: ["Why the sky turns orange at sunset"],
    visual: { type: "icon", icon: "sunset", color: "orange" },
    narration: "Why does the sky turn orange at sunset?",
  },
  {
    template: "stat",
    onScreenText: [],
    stat: { value: "5x", label: "more blue light scattered than red" },
    narration: "Blue light scatters about five times more than red.",
  },
  {
    template: "bullets",
    onScreenText: ["Evening light crosses more air"],
    visual: {
      type: "flow",
      items: [
        { icon: "sun", label: "Sunlight", color: "yellow" },
        { icon: "wind", label: "More air" },
        { icon: "eye", label: "Orange sky", color: "orange" },
      ],
    },
    narration: "At sunset light crosses more air, so the blue is gone.",
  },
];

export const brandSampleTimeline = (brand: BrandStyle, cta: string): Timeline => {
  const all = [
    ...scenes,
    { template: "title" as const, onScreenText: [cta || "Follow for more"], narration: cta || "Follow for more." },
  ];
  const words = all.flatMap((s, i) => {
    const list = s.narration.split(" ");
    return list.map((text, j) => ({
      text,
      startFrame: i * SCENE + Math.floor((j * (SCENE - 10)) / list.length),
      endFrame: i * SCENE + Math.floor(((j + 1) * (SCENE - 10)) / list.length),
    }));
  });
  // Pages of up to 3 words, like the real captions.
  const captionPages = all.flatMap((_, i) => {
    const idx = words.flatMap((w, k) => (w.startFrame >= i * SCENE && w.startFrame < (i + 1) * SCENE ? [k] : []));
    const pages = [];
    for (let p = 0; p < idx.length; p += 3) {
      const chunk = idx.slice(p, p + 3);
      const next = idx[p + 3];
      pages.push({
        startFrame: words[chunk[0] ?? 0]?.startFrame ?? i * SCENE,
        endFrame: next !== undefined ? (words[next]?.startFrame ?? (i + 1) * SCENE) : (i + 1) * SCENE,
        wordIndexes: chunk,
      });
    }
    return pages;
  });
  return {
    fps: 30,
    width: 1080,
    height: 1920,
    durationInFrames: all.length * SCENE,
    audioFile: null,
    scenes: all.map(({ narration: _, ...s }, i) => ({
      ...s,
      index: i,
      startFrame: i * SCENE,
      endFrame: (i + 1) * SCENE,
    })),
    words,
    captionPages,
    brand,
  };
};

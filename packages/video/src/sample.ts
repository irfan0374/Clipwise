import type { Timeline, TimelineScene } from "./types";

// Silent sample used by Remotion Studio and `pnpm sample`: one scene per visual type, 60 frames each.
const scenes: Omit<TimelineScene, "index" | "startFrame" | "endFrame">[] = [
  { template: "title", onScreenText: ["Why is the sky blue?"], visual: { type: "icon", icon: "sun", color: "yellow" } },
  { template: "bullets", onScreenText: ["Sunlight hits the air"], visual: { type: "flow", items: [{ icon: "sun", label: "Sunlight", color: "yellow" }, { icon: "wind", label: "Air molecules" }, { icon: "eye", label: "Your eyes", color: "green" }] } },
  { template: "bullets", onScreenText: ["Blue scatters, red passes"], visual: { type: "compare", items: [{ icon: "waves", label: "Short blue waves", color: "blue" }, { icon: "audio-waveform", label: "Long red waves", color: "red" }] } },
  { template: "bullets", onScreenText: ["Scattering by colour"], visual: { type: "bars", items: [{ label: "Violet", value: 9.4, color: "purple" }, { label: "Blue", value: 5.5, color: "blue" }, { label: "Red", value: 1, color: "red" }] } },
  { template: "bullets", onScreenText: ["GPS satellites circle Earth"], visual: { type: "orbit", icon: "earth", items: [{ icon: "satellite" }, { icon: "satellite" }, { icon: "satellite" }, {}] } },
  { template: "bullets", onScreenText: ["Different wavelengths"], visual: { type: "waves", items: [{ label: "Blue", value: 2, color: "blue" }, { label: "Green", value: 5, color: "green" }, { label: "Red", value: 9, color: "red" }] } },
  { template: "bullets", onScreenText: ["Gas molecules scatter light"], visual: { type: "particles", motion: "scatter", icon: "sun", color: "cyan" } },
  { template: "bullets", onScreenText: ["Data hops between routers"], visual: { type: "network", icon: "router", items: [{ icon: "laptop" }, { icon: "server" }, { icon: "smartphone" }, { icon: "globe" }] } },
  { template: "bullets", onScreenText: ["The seasons repeat"], visual: { type: "cycle", items: [{ icon: "flower", label: "Spring", color: "green" }, { icon: "sun", label: "Summer", color: "yellow" }, { icon: "leaf", label: "Autumn", color: "orange" }, { icon: "snowflake", label: "Winter", color: "cyan" }] } },
  { template: "stat", onScreenText: ["Blue scatters most"], stat: { value: "~5x", label: "more blue scattered than red" } },
];

const SCENE = 60;
const words = scenes.flatMap((s, i) =>
  s.onScreenText.join(" ").split(" ").map((text, j, all) => ({ text, startFrame: i * SCENE + Math.floor((j * SCENE) / all.length), endFrame: i * SCENE + Math.floor(((j + 1) * SCENE) / all.length) })),
);

export const sampleTimeline: Timeline = {
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: scenes.length * SCENE,
  audioFile: null,
  scenes: scenes.map((s, i) => ({ ...s, index: i, startFrame: i * SCENE, endFrame: (i + 1) * SCENE })),
  words,
  captionPages: scenes.map((_, i) => {
    const idx = words.flatMap((w, k) => (w.startFrame >= i * SCENE && w.startFrame < (i + 1) * SCENE ? [k] : []));
    return { startFrame: i * SCENE, endFrame: (i + 1) * SCENE, wordIndexes: idx };
  }),
};

// Shared contract between the pipeline (which builds it) and the video (which renders it).

export type SceneTemplate = "title" | "bullets" | "imageFocus" | "stat";

export type Stat = { value: string; label: string };

export const VisualTypes = ["icon", "flow", "compare", "bars", "orbit", "waves", "particles", "network", "cycle"] as const;
export type VisualType = (typeof VisualTypes)[number];

export const VisualColors = ["blue", "red", "yellow", "green", "purple", "orange", "cyan", "white"] as const;
export type VisualColor = (typeof VisualColors)[number];

export const ParticleMotions = ["scatter", "flow", "rise", "collapse"] as const;
export type ParticleMotion = (typeof ParticleMotions)[number];

export type VisualItem = { icon?: string; label?: string; value?: number; color?: VisualColor };

/** An animated illustration drawn above the scene's text. Which fields matter depends on `type`. */
export type Visual = {
  type: VisualType;
  /** Main icon: icon, orbit centre, particles/network centre. */
  icon?: string;
  /** flow / compare / bars / cycle steps, waves rows, orbit satellites. */
  items?: VisualItem[];
  motion?: ParticleMotion;
  color?: VisualColor;
};

export type TimelineScene = {
  index: number;
  template: SceneTemplate;
  startFrame: number;
  endFrame: number;
  onScreenText: string[];
  /** File name inside the render's public folder, e.g. "scene-1.jpg". */
  imageFile?: string;
  stat?: Stat;
  visual?: Visual;
};

export type TimelineWord = { text: string; startFrame: number; endFrame: number };

export type CaptionPage = { startFrame: number; endFrame: number; wordIndexes: number[] };

export type Timeline = {
  fps: 30;
  width: 1080;
  height: 1920;
  durationInFrames: number;
  /** File name inside the render's public folder, or null for silent previews. */
  audioFile: string | null;
  scenes: TimelineScene[];
  words: TimelineWord[];
  captionPages: CaptionPage[];
};

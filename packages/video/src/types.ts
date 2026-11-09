// Shared contract between the pipeline (which builds it) and the video (which renders it).

export type SceneTemplate = "title" | "bullets" | "imageFocus" | "stat";

export type Stat = { value: string; label: string };

export const VisualTypes = [
  "icon",
  "flow",
  "compare",
  "bars",
  "orbit",
  "waves",
  "particles",
  "network",
  "cycle",
] as const;
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
  /** Missing on videos made before Brand kit: they render with `defaultBrandStyle`. */
  brand?: BrandStyle;
};

// Brand kit: how one video looks. Saved on the video when it is created, so later Brand kit changes never
// restyle videos that already exist.
export const BrandFonts = ["geist", "inter", "poppins", "montserrat", "dmSans"] as const;
export type BrandFont = (typeof BrandFonts)[number];
export const TitleCasings = ["upper", "title", "sentence"] as const;
export type TitleCasing = (typeof TitleCasings)[number];
export const CaptionStyles = ["outline", "pill", "minimal"] as const;
export type CaptionStyle = (typeof CaptionStyles)[number];
export const LogoCorners = ["topRight", "topLeft", "bottomRight", "bottomLeft"] as const;
export type LogoCorner = (typeof LogoCorners)[number];

export type BrandStyle = {
  /** Highlights: hook accent bar, bullets, stats, the spoken caption word, progress bar. "#RRGGBB". */
  accent: string;
  /** Background and cards. "#RRGGBB". */
  base: string;
  font: BrandFont;
  /** Hook titles only. "sentence" keeps the text as written. */
  casing: TitleCasing;
  captionStyle: CaptionStyle;
  /** `src` is a file name inside the render's public folder, or a full URL in the browser. */
  logo: { src: string; corner: LogoCorner } | null;
};

/** Clipwise's own look: what every video had before Brand kit, and what a video without a brand gets. */
export const defaultBrandStyle: BrandStyle = {
  accent: "#3B82F6",
  base: "#0B0B0F",
  font: "geist",
  casing: "sentence",
  captionStyle: "outline",
  logo: null,
};

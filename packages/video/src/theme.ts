import { loadFont } from "@remotion/google-fonts/Geist";

const { fontFamily } = loadFont("normal", { weights: ["500", "700", "800"], subsets: ["latin"] });

export const theme = {
  background: "#0B0B0F",
  surface: "#16161D",
  text: "#FFFFFF",
  textSecondary: "#A1A1AA",
  accent: "#3B82F6",
  fontFamily,
  // 9:16 safe zones: keep content clear of Reels / TikTok / Shorts UI.
  safe: { side: 80, top: 220, bottom: 380 },
  // Main content sits above the caption band.
  contentBottom: 1180,
  // When a scene has a visual, text moves below it into this band.
  textBandTop: 890,
  textBandBottom: 1270,
  captionCenterY: 1400,
  transitionFrames: 8,
} as const;

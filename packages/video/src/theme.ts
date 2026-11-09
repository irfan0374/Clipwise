// Layout for every video. Colours and the font come from the video's Brand kit (brand.tsx, useBrand).
export const theme = {
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

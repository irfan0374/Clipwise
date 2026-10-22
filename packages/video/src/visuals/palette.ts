import type { VisualColor } from "../types";

export const colors: Record<VisualColor, string> = {
  blue: "#3B82F6",
  red: "#EF4444",
  yellow: "#FACC15",
  green: "#22C55E",
  purple: "#A855F7",
  orange: "#F97316",
  cyan: "#06B6D4",
  white: "#E4E4E7",
};

export const colorOf = (color: VisualColor | undefined, fallback: string) => (color ? colors[color] : fallback);

/** The visual box: everything is drawn inside 920×600, placed above the scene's text. */
export const BOX = { left: 80, top: 250, width: 920, height: 600 } as const;

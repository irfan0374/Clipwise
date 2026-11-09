import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { inkOn, useBrand } from "../brand";
import { theme } from "../theme";
import type { CaptionPage, CaptionStyle, TimelineWord } from "../types";

const stripTrailingPunctuation = (text: string) => text.replace(/[.,;:]+$/, "");

// Word-by-word captions: one page of 2–4 words at a time, the spoken word highlighted in the brand's style.
export const Captions = ({ words, pages }: { words: TimelineWord[]; pages: CaptionPage[] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = useBrand();
  const style = brand.captionStyle;
  const page = pages.find((p) => frame >= p.startFrame && frame < p.endFrame);
  if (!page) return null;

  const pop = spring({
    frame: frame - page.startFrame,
    fps,
    config: { damping: 14, stiffness: 220 },
    durationInFrames: 8,
  });

  return (
    <div
      style={{
        position: "absolute",
        left: theme.safe.side,
        right: theme.safe.side,
        top: theme.captionCenterY,
        transform: `translateY(-50%) scale(${0.92 + pop * 0.08})`,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: style === "pill" ? 10 : 22,
        rowGap: style === "pill" ? 10 : 4,
        textAlign: "center",
      }}
    >
      {page.wordIndexes.map((i) => {
        const word = words[i];
        if (!word) return null;
        const active = frame >= word.startFrame && frame < (words[i + 1]?.startFrame ?? page.endFrame);
        return (
          <span key={i} style={wordStyle(style, active, brand.accent)}>
            {stripTrailingPunctuation(word.text)}
          </span>
        );
      })}
    </div>
  );
};

/** Bold outline (white words, black outline, spoken word in the accent), pill badge (spoken word on an accent
 * pill) or minimal (lighter, smaller, soft shadow). */
const wordStyle = (style: CaptionStyle, active: boolean, accent: string): React.CSSProperties => {
  if (style === "pill")
    return {
      fontSize: 76,
      fontWeight: 800,
      lineHeight: 1.1,
      letterSpacing: -1,
      padding: "6px 22px 12px",
      borderRadius: 22,
      color: active ? inkOn(accent) : "#FFFFFF",
      backgroundColor: active ? accent : "rgba(0,0,0,0.55)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    };
  if (style === "minimal")
    return {
      fontSize: 68,
      fontWeight: 700,
      lineHeight: 1.15,
      letterSpacing: -0.5,
      color: active ? accent : "#FFFFFF",
      textShadow: "0 4px 18px rgba(0,0,0,0.75)",
    };
  return {
    fontSize: 84,
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: -1,
    color: active ? accent : "#FFFFFF",
    WebkitTextStroke: "10px #000",
    paintOrder: "stroke fill",
    textShadow: "0 6px 24px rgba(0,0,0,0.5)",
  };
};

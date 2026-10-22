import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import type { CaptionPage, TimelineWord } from "../types";

const stripTrailingPunctuation = (text: string) => text.replace(/[.,;:]+$/, "");

// Word-by-word captions: one page of 2–4 words at a time, the spoken word in the accent colour.
export const Captions = ({ words, pages }: { words: TimelineWord[]; pages: CaptionPage[] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
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
        columnGap: 22,
        rowGap: 4,
        textAlign: "center",
      }}
    >
      {page.wordIndexes.map((i) => {
        const word = words[i];
        if (!word) return null;
        const active = frame >= word.startFrame && frame < (words[i + 1]?.startFrame ?? page.endFrame);
        return (
          <span
            key={i}
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: -1,
              color: active ? theme.accent : theme.text,
              WebkitTextStroke: "10px #000",
              paintOrder: "stroke fill",
              textShadow: "0 6px 24px rgba(0,0,0,0.5)",
            }}
          >
            {stripTrailingPunctuation(word.text)}
          </span>
        );
      })}
    </div>
  );
};

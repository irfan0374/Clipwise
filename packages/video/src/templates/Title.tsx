import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

// Hook / opening question: big headline, words rise in one by one.
export const Title = ({ text, compact = false }: { text: string; compact?: boolean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <AbsoluteFill
      style={
        compact
          ? { padding: `${theme.textBandTop}px ${theme.safe.side}px 0`, alignItems: "center", textAlign: "center" }
          : {
              padding: `${theme.safe.top}px ${theme.safe.side}px 0`,
              justifyContent: "center",
              height: theme.contentBottom,
            }
      }
    >
      {compact ? null : (
        <div style={{ width: 96, height: 8, borderRadius: 4, backgroundColor: theme.accent, marginBottom: 48 }} />
      )}
      <h1 style={{ margin: 0, fontSize: compact ? 92 : 112, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3 }}>
        {words.map((word, i) => {
          const progress = spring({ frame: frame - i * 4, fps, config: { damping: 200 } });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: 24,
                opacity: progress,
                transform: `translateY(${(1 - progress) * 40}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </h1>
    </AbsoluteFill>
  );
};

import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

// Lines appear in sequence across the first two-thirds of the scene.
export const lineStartFrame = (i: number, count: number, duration: number) =>
  count <= 1 ? 0 : Math.round((i * (duration * (2 / 3))) / count);

export const Bullets = ({ lines, duration, compact = false }: { lines: string[]; duration: number; compact?: boolean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={
        compact
          ? { padding: `${theme.textBandTop}px ${theme.safe.side}px 0`, gap: 24 }
          : { padding: `${theme.safe.top}px ${theme.safe.side}px 0`, justifyContent: "center", height: theme.contentBottom, gap: 56 }
      }
    >
      {lines.map((line, i) => {
        const progress = spring({ frame: frame - lineStartFrame(i, lines.length, duration), fps, config: { damping: 200 } });
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 36,
              opacity: progress,
              transform: `translateX(${(1 - progress) * -60}px)`,
            }}
          >
            <div style={{ flexShrink: 0, width: compact ? 16 : 20, height: compact ? 16 : 20, borderRadius: 10, marginTop: compact ? 24 : 34, backgroundColor: theme.accent }} />
            <div style={{ fontSize: compact ? 58 : 76, fontWeight: 700, lineHeight: 1.12, letterSpacing: -1.5 }}>{line}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { formatStat, parseStat } from "./stat-number";

export const Stat = ({ value, label }: { value: string; label: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const parsed = parseStat(value);
  const count = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp", easing: (t) => 1 - (1 - t) ** 3 });
  const shown = parsed ? formatStat(parsed, count) : value;
  const labelIn = spring({ frame: frame - 18, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        padding: `${theme.safe.top}px ${theme.safe.side}px 0`,
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        height: theme.contentBottom,
      }}
    >
      <div
        style={{
          fontSize: Math.min(300, Math.round(1200 / Math.max(value.length, 1))),
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: -10,
          color: theme.accent,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {shown}
      </div>
      <div
        style={{
          marginTop: 40,
          fontSize: 60,
          fontWeight: 500,
          lineHeight: 1.2,
          color: theme.textSecondary,
          opacity: labelIn,
          transform: `translateY(${(1 - labelIn) * 24}px)`,
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
};

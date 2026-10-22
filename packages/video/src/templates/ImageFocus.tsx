import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

// Full-screen photo with a slow zoom and pan; one label line at the top.
export const ImageFocus = ({ src, label, duration }: { src: string; label: string; duration: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = interpolate(frame, [0, duration], [1, 1.1], { extrapolateRight: "clamp" });
  const panX = interpolate(frame, [0, duration], [-20, 20], { extrapolateRight: "clamp" });
  const labelIn = spring({ frame: frame - 6, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translateX(${panX}px)` }} />
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(11,11,15,0.85) 0%, rgba(11,11,15,0) 30%, rgba(11,11,15,0) 55%, rgba(11,11,15,0.9) 100%)",
        }}
      />
      {label ? (
        <div
          style={{
            position: "absolute",
            top: theme.safe.top,
            left: theme.safe.side,
            right: theme.safe.side,
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: -1.5,
            opacity: labelIn,
            transform: `translateY(${(1 - labelIn) * -30}px)`,
          }}
        >
          {label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

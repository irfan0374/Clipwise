import { useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

export const ProgressBar = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, backgroundColor: "rgba(255,255,255,0.12)" }}
    >
      <div style={{ width: `${(frame / durationInFrames) * 100}%`, height: "100%", backgroundColor: theme.accent }} />
    </div>
  );
};

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../theme";

// Slowly drifting colour glows over a faint dot grid, so no scene sits on flat black.
export const Background = () => {
  const frame = useCurrentFrame();
  const ax = 300 + Math.sin(frame / 90) * 180;
  const ay = 500 + Math.cos(frame / 110) * 160;
  const bx = 800 + Math.cos(frame / 100) * 160;
  const by = 1300 + Math.sin(frame / 80) * 200;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(700px circle at ${ax}px ${ay}px, ${theme.accent}30, transparent 70%), radial-gradient(800px circle at ${bx}px ${by}px, #A855F724, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 2px, transparent 2px)",
          backgroundSize: "48px 48px",
          backgroundPosition: `0px ${-frame * 0.3}px`,
        }}
      />
    </AbsoluteFill>
  );
};

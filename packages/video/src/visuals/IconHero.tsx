import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { IconBadge } from "./IconBadge";
import { BOX } from "./palette";

// One large icon that pops in, floats gently, and sends out pulse rings.
export const IconHero = ({ icon, color }: { icon: string | undefined; color: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const float = Math.sin(frame / 18) * 12;
  const cx = BOX.width / 2;
  const cy = BOX.height / 2;
  const size = 300;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: cx - 280,
          top: cy - 280,
          width: 560,
          height: 560,
          borderRadius: 280,
          background: `radial-gradient(circle, ${color}40 0%, ${color}00 70%)`,
        }}
      />
      {[0, 1, 2].map((i) => {
        const t = ((frame + i * 25) % 75) / 75;
        const r = interpolate(t, [0, 1], [size / 2, size / 2 + 150]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx - r,
              top: cy - r + float,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              border: `4px solid ${color}`,
              opacity: (1 - t) * 0.5 * pop,
            }}
          />
        );
      })}
      <IconBadge
        icon={icon}
        size={size}
        color={color}
        style={{ position: "absolute", left: cx - size / 2, top: cy - size / 2 + float, transform: `scale(${pop})` }}
      />
    </div>
  );
};

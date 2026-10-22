import { random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ParticleMotion } from "../types";
import { IconBadge } from "./IconBadge";
import { BOX } from "./palette";

const COUNT = 110;

// Deterministic particle field (same every render): scatter outward, flow across, rise, or collapse inward.
export const Particles = ({
  motion,
  icon,
  color,
}: {
  motion: ParticleMotion;
  icon: string | undefined;
  color: string;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cx = BOX.width / 2;
  const cy = BOX.height / 2;
  const R = 460;
  const pop = spring({ frame, fps, config: { damping: 14 } });
  const centred = motion === "scatter" || motion === "collapse";

  const dots = Array.from({ length: COUNT }, (_, i) => {
    const r1 = random(`p1-${i}`);
    const r2 = random(`p2-${i}`);
    const r3 = random(`p3-${i}`);
    const speed = 2 + r3 * 4;
    const size = 8 + r2 * 16;
    let x = 0;
    let y = 0;
    let fade = 1;
    if (centred) {
      const angle = r1 * Math.PI * 2;
      const travel = (r2 * R + frame * speed) % R;
      const dist = motion === "scatter" ? travel : R - travel;
      x = cx + Math.cos(angle) * dist;
      y = cy + Math.sin(angle) * dist * 0.75;
      fade = motion === "scatter" ? 1 - dist / R : dist / R;
    } else if (motion === "flow") {
      x = (r1 * BOX.width + frame * speed * 2) % BOX.width;
      y = r2 * BOX.height + Math.sin(frame / 15 + i) * 12;
      fade = Math.sin((x / BOX.width) * Math.PI);
    } else {
      x = r1 * BOX.width + Math.sin(frame / 20 + i) * 14;
      y = BOX.height - ((r2 * BOX.height + frame * speed) % BOX.height);
      fade = Math.sin((y / BOX.height) * Math.PI);
    }
    return { x, y, size, opacity: Math.max(0, fade) * 0.9 * pop };
  });

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: d.x - d.size / 2,
            top: d.y - d.size / 2,
            width: d.size,
            height: d.size,
            borderRadius: d.size,
            backgroundColor: color,
            opacity: d.opacity,
            boxShadow: `0 0 ${d.size}px ${color}`,
          }}
        />
      ))}
      {icon ? (
        <IconBadge
          icon={icon}
          size={centred ? 200 : 170}
          color={color}
          filled={motion === "collapse"}
          style={{
            position: "absolute",
            left: cx - (centred ? 100 : 85),
            top: cy - (centred ? 100 : 85),
            transform: `scale(${pop})`,
          }}
        />
      ) : null}
    </div>
  );
};

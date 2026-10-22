import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualItem } from "../types";
import { IconBadge } from "./IconBadge";
import { Label } from "./Label";
import { BOX, colorOf } from "./palette";

// 3–4 steps around a loop; a dashed ring turns and the active step is highlighted in turn.
export const Cycle = ({ items, color, duration }: { items: VisualItem[]; color: string; duration: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const steps = items.slice(0, 4);
  const n = Math.max(3, steps.length);
  const cx = BOX.width / 2;
  const cy = BOX.height / 2 - 10;
  const r = 215;
  const badge = 130;
  const active = Math.min(n - 1, Math.floor(frame / Math.max(1, duration / n)));
  const ringIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={BOX.width} height={BOX.height} style={{ position: "absolute", inset: 0 }}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeOpacity={0.5 * ringIn}
          strokeWidth={6}
          strokeDasharray="30 22"
          strokeLinecap="round"
          transform={`rotate(${frame * 1.5} ${cx} ${cy})`}
        />
      </svg>
      {steps.map((item, i) => {
        const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const p = spring({ frame: frame - i * 6, fps, config: { damping: 12 } });
        const isActive = i === active;
        // Labels sit outside the ring: above for the top step, below for the rest.
        const labelAbove = Math.sin(angle) < -0.5;
        return (
          <div key={i} style={{ position: "absolute", left: x - badge / 2, top: y - badge / 2, transform: `scale(${p * (isActive ? 1.15 : 1)})` }}>
            <IconBadge icon={item.icon} size={badge} color={colorOf(item.color, color)} filled={isActive} />
            <Label
              text={item.label}
              width={230}
              size={34}
              style={{ position: "absolute", left: badge / 2 - 115, top: labelAbove ? -58 : badge + 10, opacity: isActive ? 1 : 0.7 }}
            />
          </div>
        );
      })}
    </div>
  );
};

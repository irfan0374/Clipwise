import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualItem } from "../types";
import { IconBadge } from "./IconBadge";
import { BOX, colorOf } from "./palette";
import { Label } from "./Label";

// 2–4 steps left to right; each appears in turn, arrows draw between them, then a pulse travels the chain.
export const Flow = ({ items, color, duration }: { items: VisualItem[]; color: string; duration: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(2, Math.min(4, items.length));
  const steps = items.slice(0, n);
  const badge = n === 4 ? 150 : 190;
  const margin = badge / 2 + 20;
  const xs = steps.map((_, i) => margin + (i * (BOX.width - margin * 2)) / (n - 1));
  const cy = 230;
  const stagger = Math.max(8, Math.floor((duration * 0.5) / n));
  const appear = (i: number) => spring({ frame: frame - i * stagger, fps, config: { damping: 14 } });
  const allIn = (n - 1) * stagger + 15;
  const pulseT = frame > allIn ? ((frame - allIn) % 45) / 45 : -1;
  const pulseX = pulseT >= 0 ? interpolate(pulseT, [0, 1], [xs[0]!, xs[n - 1]!]) : 0;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={BOX.width} height={BOX.height} style={{ position: "absolute", inset: 0 }}>
        {steps.slice(1).map((_, k) => {
          const x1 = xs[k]! + badge / 2 + 10;
          const x2 = xs[k + 1]! - badge / 2 - 10;
          const grow = interpolate(frame, [(k + 1) * stagger - 6, (k + 1) * stagger + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const end = x1 + (x2 - x1) * grow;
          return (
            <g key={k} opacity={grow}>
              <line x1={x1} y1={cy} x2={end} y2={cy} stroke={color} strokeWidth={6} strokeDasharray="14 12" strokeDashoffset={-frame * 2} strokeLinecap="round" />
              <path d={`M${end - 18} ${cy - 16} L${end} ${cy} L${end - 18} ${cy + 16}`} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        {pulseT >= 0 ? <circle cx={pulseX} cy={cy} r={14} fill="#FFFFFF" opacity={0.9} style={{ filter: `drop-shadow(0 0 12px ${color})` }} /> : null}
      </svg>
      {steps.map((item, i) => {
        const a = appear(i);
        return (
          <div key={i} style={{ position: "absolute", left: xs[i]! - 120, top: cy - badge / 2, width: 240, display: "flex", flexDirection: "column", alignItems: "center", opacity: a, transform: `scale(${0.6 + a * 0.4})` }}>
            <IconBadge icon={item.icon} size={badge} color={colorOf(item.color, color)} />
            <Label text={item.label} width={240} style={{ marginTop: 26 }} />
          </div>
        );
      })}
    </div>
  );
};

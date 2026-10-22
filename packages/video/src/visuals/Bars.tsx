import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import type { VisualItem } from "../types";
import { Label } from "./Label";
import { BOX, colorOf } from "./palette";

const formatValue = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

// 2–4 bars grow from the baseline in turn; values count up above them.
export const Bars = ({ items, color }: { items: VisualItem[]; color: string }) => {
  const frame = useCurrentFrame();
  const bars = items.slice(0, 4);
  const n = Math.max(1, bars.length);
  const max = Math.max(...bars.map((b) => b.value ?? 0), 1);
  const slot = BOX.width / n;
  const barW = Math.min(170, slot * 0.6);
  const baseY = 470;
  const maxH = 360;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: baseY,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.textSecondary,
          opacity: 0.4,
        }}
      />
      {bars.map((bar, i) => {
        const grow = interpolate(frame, [i * 8, i * 8 + 28], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: (t) => 1 - (1 - t) ** 3,
        });
        const value = bar.value ?? 0;
        const h = Math.max(8, (value / max) * maxH * grow);
        const x = slot * i + (slot - barW) / 2;
        const c = colorOf(bar.color, color);
        return (
          <div key={i}>
            <div
              style={{
                position: "absolute",
                left: x,
                top: baseY - h,
                width: barW,
                height: h,
                borderRadius: "18px 18px 4px 4px",
                background: `linear-gradient(180deg, ${c} 0%, ${c}99 100%)`,
                boxShadow: `0 0 40px ${c}44`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: slot * i,
                width: slot,
                top: baseY - h - 64,
                textAlign: "center",
                fontSize: 48,
                fontWeight: 800,
                color: theme.text,
                opacity: grow,
              }}
            >
              {formatValue(value * grow)}
            </div>
            <Label
              text={bar.label}
              width={slot - 10}
              size={36}
              style={{ position: "absolute", left: slot * i + 5, top: baseY + 22 }}
            />
          </div>
        );
      })}
    </div>
  );
};

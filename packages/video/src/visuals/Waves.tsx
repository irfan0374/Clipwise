import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import type { VisualItem } from "../types";
import { BOX, colorOf, colors } from "./palette";

const defaultColors = [colors.blue, colors.green, colors.red];

// 1–3 travelling sine waves stacked; `value` 1–10 sets the wavelength (1 = short, 10 = long).
export const Waves = ({ items, color }: { items: VisualItem[]; color: string }) => {
  const frame = useCurrentFrame();
  const rows = (items.length ? items : [{}]).slice(0, 3);
  const rowH = BOX.height / rows.length;
  const reveal = interpolate(frame, [0, 24], [0, BOX.width], { extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={BOX.width} height={BOX.height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="wave-reveal">
            <rect x={0} y={0} width={reveal} height={BOX.height} />
          </clipPath>
        </defs>
        {rows.map((item, i) => {
          const c = item.color ? colorOf(item.color, color) : rows.length === 1 ? color : defaultColors[i]!;
          const value = Math.max(1, Math.min(10, item.value ?? [2, 5, 9][i] ?? 5));
          const wavelength = 50 + value * 28;
          const amp = Math.min(70, rowH * 0.28);
          const mid = rowH * i + rowH / 2 + (item.label ? 22 : 0);
          const phase = frame * 5;
          let d = "";
          for (let x = 0; x <= BOX.width; x += 6) {
            const y = mid + Math.sin(((x - phase) / wavelength) * Math.PI * 2) * amp;
            d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)} `;
          }
          return (
            <g key={i} clipPath="url(#wave-reveal)">
              <path d={d} fill="none" stroke={c} strokeWidth={9} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 10px ${c})` }} />
            </g>
          );
        })}
      </svg>
      {rows.map((item, i) =>
        item.label ? (
          <div key={i} style={{ position: "absolute", left: 0, top: rowH * i + 4, fontSize: 36, fontWeight: 700, color: theme.text }}>
            {item.label}
          </div>
        ) : null,
      )}
    </div>
  );
};

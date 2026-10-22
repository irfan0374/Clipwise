import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualItem } from "../types";
import { IconBadge } from "./IconBadge";
import { BOX, colorOf } from "./palette";

// A centre icon with 3–6 satellites circling on tilted orbits; satellites pass behind and in front of it.
export const Orbit = ({ icon, items, color }: { icon: string | undefined; items: VisualItem[]; color: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cx = BOX.width / 2;
  const cy = BOX.height / 2;
  const count = Math.max(3, Math.min(6, items.length || 3));
  const pop = spring({ frame, fps, config: { damping: 12 } });
  const rings = [{ rx: 420, ry: 150 }, { rx: 300, ry: 110 }];

  const satellites = Array.from({ length: count }, (_, i) => {
    const ring = rings[i % 2]!;
    const speed = i % 2 ? 0.035 : 0.025;
    const angle = (i / count) * Math.PI * 2 + frame * speed;
    const depth = Math.sin(angle); // -1 behind, +1 in front
    return { i, x: cx + Math.cos(angle) * ring.rx, y: cy + depth * ring.ry, depth, item: items[i] };
  });

  const renderSat = (s: (typeof satellites)[number]) => {
    const scale = 0.75 + (s.depth + 1) * 0.2;
    const c = colorOf(s.item?.color, color);
    const size = s.item?.icon ? 110 : 40;
    return (
      <div key={s.i} style={{ position: "absolute", left: s.x - size / 2, top: s.y - size / 2, transform: `scale(${scale * pop})`, opacity: 0.55 + (s.depth + 1) * 0.225 }}>
        {s.item?.icon ? (
          <IconBadge icon={s.item.icon} size={size} color={c} />
        ) : (
          <div style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c, boxShadow: `0 0 24px ${c}` }} />
        )}
      </div>
    );
  };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={BOX.width} height={BOX.height} style={{ position: "absolute", inset: 0, opacity: pop }}>
        {rings.map((r, k) => (
          <ellipse key={k} cx={cx} cy={cy} rx={r.rx} ry={r.ry} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={3} strokeDasharray="6 10" />
        ))}
      </svg>
      {satellites.filter((s) => s.depth < 0).map(renderSat)}
      <IconBadge icon={icon} size={220} color={color} style={{ position: "absolute", left: cx - 110, top: cy - 110, transform: `scale(${pop})` }} />
      {satellites.filter((s) => s.depth >= 0).map(renderSat)}
    </div>
  );
};

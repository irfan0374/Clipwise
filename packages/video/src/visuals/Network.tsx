import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualItem } from "../types";
import { IconBadge } from "./IconBadge";
import { BOX, colorOf } from "./palette";

// Fixed layout: a hub in the middle, seven nodes around it, signals pulsing along the links.
const nodes = [
  { x: 460, y: 300 },
  { x: 120, y: 110 },
  { x: 460, y: 60 },
  { x: 800, y: 110 },
  { x: 860, y: 400 },
  { x: 600, y: 540 },
  { x: 300, y: 540 },
  { x: 60, y: 400 },
];
const edges: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [0, 7],
  [1, 2],
  [2, 3],
  [3, 4],
  [5, 6],
  [6, 7],
  [7, 1],
];

export const Network = ({ icon, items, color }: { icon: string | undefined; items: VisualItem[]; color: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const outer = items.slice(0, 4);
  // Item icons go on alternating outer nodes so they spread around the hub.
  const iconNodes = [1, 3, 5, 7];

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={BOX.width} height={BOX.height} style={{ position: "absolute", inset: 0 }}>
        {edges.map(([a, b], k) => {
          const A = nodes[a]!;
          const B = nodes[b]!;
          const draw = interpolate(frame, [k * 2, k * 2 + 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const t = ((frame + k * 11) % 40) / 40;
          return (
            <g key={k}>
              <line
                x1={A.x}
                y1={A.y}
                x2={A.x + (B.x - A.x) * draw}
                y2={A.y + (B.y - A.y) * draw}
                stroke={color}
                strokeOpacity={0.45}
                strokeWidth={4}
              />
              {draw === 1 ? (
                <circle
                  cx={A.x + (B.x - A.x) * t}
                  cy={A.y + (B.y - A.y) * t}
                  r={8}
                  fill="#FFFFFF"
                  style={{ filter: `drop-shadow(0 0 8px ${color})` }}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      {nodes.slice(1).map((n, i) => {
        const nodeIndex = i + 1;
        const slot = iconNodes.indexOf(nodeIndex);
        const item = slot >= 0 ? outer[slot] : undefined;
        const p = spring({ frame: frame - nodeIndex * 3, fps, config: { damping: 12 } });
        if (item?.icon) {
          return (
            <IconBadge
              key={nodeIndex}
              icon={item.icon}
              size={110}
              color={colorOf(item.color, color)}
              style={{ position: "absolute", left: n.x - 55, top: n.y - 55, transform: `scale(${p})` }}
            />
          );
        }
        return (
          <div
            key={nodeIndex}
            style={{
              position: "absolute",
              left: n.x - 20,
              top: n.y - 20,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: color,
              boxShadow: `0 0 24px ${color}`,
              transform: `scale(${p})`,
            }}
          />
        );
      })}
      <IconBadge
        icon={icon ?? "network"}
        size={190}
        color={color}
        filled
        style={{
          position: "absolute",
          left: nodes[0]!.x - 95,
          top: nodes[0]!.y - 95,
          transform: `scale(${spring({ frame, fps, config: { damping: 12 } })})`,
        }}
      />
    </div>
  );
};

import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import type { VisualItem } from "../types";
import { IconBadge } from "./IconBadge";
import { Label } from "./Label";
import { BOX, colorOf, colors } from "./palette";

// Two cards slide in from opposite sides with a "vs" badge between them.
export const Compare = ({ items }: { items: VisualItem[] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [left, right] = [items[0] ?? {}, items[1] ?? {}];
  const cardW = 400;
  const cardH = 480;
  const top = (BOX.height - cardH) / 2;
  const inL = spring({ frame, fps, config: { damping: 15 } });
  const inR = spring({ frame: frame - 8, fps, config: { damping: 15 } });
  const vs = spring({ frame: frame - 16, fps, config: { damping: 10 } });

  const card = (item: VisualItem, fallback: string, x: number, progress: number, from: number) => {
    const c = colorOf(item.color, fallback);
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top,
          width: cardW,
          height: cardH,
          borderRadius: 32,
          backgroundColor: theme.surface,
          border: `3px solid ${c}66`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          opacity: progress,
          transform: `translateX(${(1 - progress) * from}px)`,
        }}
      >
        <IconBadge icon={item.icon} size={190} color={c} />
        <Label text={item.label} width={cardW - 40} size={44} />
      </div>
    );
  };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {card(left, colors.blue, 0, inL, -200)}
      {card(right, colors.red, BOX.width - cardW, inR, 200)}
      <div
        style={{
          position: "absolute",
          left: BOX.width / 2 - 55,
          top: BOX.height / 2 - 55,
          width: 110,
          height: 110,
          borderRadius: 55,
          backgroundColor: theme.background,
          border: `3px solid ${theme.textSecondary}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
          fontWeight: 800,
          color: theme.text,
          transform: `scale(${vs})`,
        }}
      >
        vs
      </div>
    </div>
  );
};

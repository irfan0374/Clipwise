import { theme } from "../theme";
import type { Visual } from "../types";
import { Bars } from "./Bars";
import { Compare } from "./Compare";
import { Cycle } from "./Cycle";
import { Flow } from "./Flow";
import { IconHero } from "./IconHero";
import { Network } from "./Network";
import { Orbit } from "./Orbit";
import { BOX, colorOf } from "./palette";
import { Particles } from "./Particles";
import { Waves } from "./Waves";

const Body = ({ visual, duration }: { visual: Visual; duration: number }) => {
  const color = colorOf(visual.color, theme.accent);
  const items = visual.items ?? [];
  switch (visual.type) {
    case "icon":
      return <IconHero icon={visual.icon} color={color} />;
    case "flow":
      return <Flow items={items} color={color} duration={duration} />;
    case "compare":
      return <Compare items={items} />;
    case "bars":
      return <Bars items={items} color={color} />;
    case "orbit":
      return <Orbit icon={visual.icon} items={items} color={color} />;
    case "waves":
      return <Waves items={items} color={color} />;
    case "particles":
      return <Particles motion={visual.motion ?? "scatter"} icon={visual.icon} color={color} />;
    case "network":
      return <Network icon={visual.icon} items={items} color={color} />;
    case "cycle":
      return <Cycle items={items} color={color} duration={duration} />;
  }
};

export const VisualView = ({ visual, duration }: { visual: Visual; duration: number }) => (
  <div style={{ position: "absolute", left: BOX.left, top: BOX.top, width: BOX.width, height: BOX.height }}>
    <Body visual={visual} duration={duration} />
  </div>
);

import type { VisualType } from "@clipwise/video";
import { Explainer } from "@clipwise/video/explainer";
import {
  ChartColumn,
  Columns2,
  Hash,
  Heading,
  List,
  type LucideIcon,
  Network,
  Orbit,
  RefreshCw,
  Shapes,
  Sparkles,
  Waves,
  Workflow,
} from "lucide-react";
import type { ComponentType } from "react";
import type { VideoView } from "@/lib/videos";

export type Scene = VideoView["scenes"][number];

// Remotion's component props are the timeline; the Player needs a loosely typed component.
export const Composition = Explainer as unknown as ComponentType<Record<string, unknown>>;
export const FPS = 30;

export const clock = (frame: number) => {
  const s = Math.max(0, Math.round(frame / FPS));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
export const seconds = (s: Scene) => ((s.endFrame - s.startFrame) / FPS).toFixed(1);

// Scene colours for the timing bar, as in the Stitch Storyboard; a scene with a claim to review is amber.
export const sceneColors = [
  "#0F0F0F",
  "#14B8A6",
  "#0F766E",
  "#3B82F6",
  "#10B981",
  "#6366F1",
  "#8B5CF6",
  "#0EA5E9",
  "#84CC16",
];
export const REVIEW = "#F59E0B";

/** The 9 animations, in the order of Stitch's 3×3 "Visual Template" grid. */
export const visualTiles: { type: VisualType; label: string; icon: LucideIcon }[] = [
  { type: "icon", label: "Icon", icon: Shapes },
  { type: "flow", label: "Flow", icon: Workflow },
  { type: "compare", label: "Compare", icon: Columns2 },
  { type: "bars", label: "Bars", icon: ChartColumn },
  { type: "orbit", label: "Orbit", icon: Orbit },
  { type: "waves", label: "Waves", icon: Waves },
  { type: "particles", label: "Particles", icon: Sparkles },
  { type: "network", label: "Network", icon: Network },
  { type: "cycle", label: "Cycle", icon: RefreshCw },
];

export const sceneIcon = (s: Scene): LucideIcon =>
  s.template === "stat"
    ? Hash
    : (visualTiles.find((t) => t.type === s.visual?.type)?.icon ?? (s.template === "title" ? Heading : List));

export const visualName = (s: Scene) =>
  s.template === "stat" ? "Big number" : (visualTiles.find((t) => t.type === s.visual?.type)?.label ?? "Text");

/** Bars show data: only offered when the scene already has at least two numbers (never invented). */
export const canUseBars = (s: Scene) =>
  (s.visual?.items?.filter((i) => typeof i.value === "number" && i.label).length ?? 0) >= 2;

/** CSS colours for the animation colour names. */
export const swatches: Record<string, string> = {
  blue: "#3B82F6",
  red: "#EF4444",
  yellow: "#FACC15",
  green: "#22C55E",
  purple: "#8B5CF6",
  orange: "#F97316",
  cyan: "#22D3EE",
  white: "#FFFFFF",
};

export const roleOf = (scene: Scene, i: number, count: number) =>
  i === 0
    ? "Hook"
    : i === count - 1
      ? "Outro"
      : scene.template === "stat"
        ? "Number"
        : scene.template === "title"
          ? "Title"
          : "Points";

/** The words shown over the frame: the big number, else the first on-screen line, else the first sentence. */
export const quoteOf = (scene: Scene) =>
  scene.stat
    ? `${scene.stat.value} ${scene.stat.label}`.trim()
    : (scene.onScreenText[0] ?? scene.narration.split(/(?<=[.!?])\s/)[0] ?? "");

/** Scene i's position after moving scene `from` to position `to` (for drag and drop). */
export const moveOrder = (count: number, from: number, to: number) => {
  const order = Array.from({ length: count }, (_, i) => i);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved!);
  return order;
};

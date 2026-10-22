import type { VideoStatus } from "@clipwise/shared";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type BadgeVariant = "neutral" | "teal" | "lime" | "red";

/** Lime = working on it, teal = ready, red = needs attention. */
export const videoStatusBadge: Record<VideoStatus, { label: string; variant: BadgeVariant; busy?: boolean }> = {
  draft: { label: "Draft", variant: "neutral" },
  scripting: { label: "Writing script", variant: "lime", busy: true },
  checking: { label: "Fact-checking", variant: "lime", busy: true },
  previewed: { label: "Ready to review", variant: "teal" },
  voicing: { label: "Recording voice", variant: "lime", busy: true },
  rendering: { label: "Rendering", variant: "lime", busy: true },
  rendered: { label: "Ready", variant: "teal" },
  failed: { label: "Failed", variant: "red" },
};

export function StatusBadge({ status }: { status: VideoStatus }) {
  const { label, variant, busy } = videoStatusBadge[status];
  return (
    <Badge variant={variant}>
      {busy && <Loader2 className="animate-spin" />}
      {label}
    </Badge>
  );
}

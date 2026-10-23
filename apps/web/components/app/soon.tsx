import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A control from the design whose feature isn't built yet: shown as designed, disabled, with a
 * "Coming soon" tooltip. The span wrapper is needed because a disabled button can't show a tooltip.
 */
export function Soon({ children, label = "Coming soon" }: { children: ReactNode; label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-not-allowed [&>*]:pointer-events-none">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

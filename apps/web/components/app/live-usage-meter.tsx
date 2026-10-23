"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { UsageMeter } from "./usage-meter";

type Usage = { used: number; limit: number };

/** Fired after an action that changes today's usage (e.g. a new video), so the meter updates at once. */
export const USAGE_CHANGED = "clipwise:usage-changed";

/**
 * The sidebar lives in the layout, which doesn't re-render on navigation, so the meter refreshes itself:
 * on every page change, when the tab regains focus (other tabs may have created videos) and on USAGE_CHANGED.
 */
export function LiveUsageMeter({ initial }: { initial: Usage }) {
  const [usage, setUsage] = useState(initial);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      if (res.ok) setUsage(((await res.json()) as { videos: Usage }).videos);
    } catch {}
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refetch whenever the page changes
  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    window.addEventListener(USAGE_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(USAGE_CHANGED, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return <UsageMeter label="Videos today" used={Math.min(usage.used, usage.limit)} limit={usage.limit} />;
}

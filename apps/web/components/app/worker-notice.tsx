"use client";

import { cn } from "cn";
import { PauseCircle } from "lucide-react";
import { useEffect, useState } from "react";

const POLL_MS = 45_000;

/**
 * Tells people when video making is paused because the worker isn't running (during the beta it runs on one
 * computer). Work started meanwhile waits in line and begins on its own when the worker is back. Shows nothing
 * while the worker is online.
 */
export function WorkerNotice({
  online: initial,
  className,
  waiting = false,
}: {
  online: boolean;
  className?: string;
  /** This page's video is waiting for the worker (Generating screen, a render in line). */
  waiting?: boolean;
}) {
  const [online, setOnline] = useState(initial);
  useEffect(() => setOnline(initial), [initial]);
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch("/api/worker-status", { cache: "no-store" });
        if (res.ok && !stopped) setOnline(((await res.json()) as { online: boolean }).online);
      } catch {}
    };
    const timer = setInterval(() => document.visibilityState === "visible" && void check(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);
  if (online) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-[#FDE68A] bg-amber-soft px-4 py-3 text-[13px] text-amber-ink",
        className,
      )}
    >
      <PauseCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">Video making is paused right now.</span>{" "}
        {waiting
          ? "Your video is saved and in line. It will continue on its own as soon as Clipwise is back online."
          : "You can still start a video: it waits in line and begins on its own as soon as Clipwise is back online."}
      </p>
    </div>
  );
}

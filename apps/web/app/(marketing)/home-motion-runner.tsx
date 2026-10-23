"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { startHomeMotion } from "./home-motion";

/** Wraps the static homepage markup and starts GSAP + Lenis once it's on screen. */
export function HomeMotionRunner({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? startHomeMotion(ref.current) : undefined), []);
  // overflow-x-clip: the hero glow is wider than a phone screen and would cause sideways scrolling
  return (
    <div ref={ref} className="overflow-x-clip">
      {children}
    </div>
  );
}

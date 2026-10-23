"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Content column for signed-in pages (up to 1120px). A video's page (/videos/:id) is full width instead:
 * the Generating and Storyboard screens draw their own top bar edge to edge, as in the Stitch designs.
 */
export function PageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (/^\/videos\/[^/]+$/.test(pathname)) return children;
  return <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-8 lg:py-12">{children}</div>;
}

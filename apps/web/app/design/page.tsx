import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StyleTile } from "./style-tile";

export const metadata: Metadata = { title: "Design system" };

/** Dev-only style tile: every component and state on one page. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <StyleTile />;
}

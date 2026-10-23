import type { Metadata } from "next";
import { HomeMarkup } from "./home-markup";
import { HomeMotionRunner } from "./home-motion-runner";
import "./home.css";

export const metadata: Metadata = {
  title: { absolute: "Clipwise — Turn any idea into short videos" },
  description:
    "Clipwise writes, fact-checks, voices and animates short videos for Reels, Shorts and TikTok: promos, explainers, stories, tips and more.",
};

export default function HomePage() {
  return (
    <HomeMotionRunner>
      <HomeMarkup />
    </HomeMotionRunner>
  );
}

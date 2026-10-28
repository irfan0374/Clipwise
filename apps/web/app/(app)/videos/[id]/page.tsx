import { dailyUsage, workerStatus } from "@clipwise/queue";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveVideo } from "@/components/video/live-video";
import { Studio } from "@/components/video/studio";
import { VideoReady } from "@/components/video/video-ready";
import { requireUser } from "@/lib/session";
import { finalForOwner, videoForOwner } from "@/lib/videos";

export const metadata: Metadata = { title: "Video" };

export default async function VideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; scene?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { user, workspace } = await requireUser();
  const video = await videoForOwner(id, workspace._id);
  if (!video) notFound();
  const final = await finalForOwner(id, workspace._id);
  if (final && video.status === "rendered" && query.tab !== "edit" && query.tab !== "storyboard")
    return <VideoReady video={video} final={final} />;
  // Script written and checked: the Storyboard and Editor. Anything still running, stopped or failed: the progress view.
  const ready =
    video.timeline && video.steps.factcheck.state === "done" && ["previewed", "rendered"].includes(video.status);
  const { online: workerOnline } = await workerStatus();
  if (!ready) return <LiveVideo video={video} workerOnline={workerOnline} />;
  const usage = await dailyUsage(user.id);
  // ?tab=edit&scene=2 opens the Editor on scene 2 (1-based in the address bar).
  const scene = Math.max(0, Math.min(video.scenes.length - 1, (Number.parseInt(query.scene ?? "1", 10) || 1) - 1));
  return (
    <Studio
      video={video}
      lastFinal={final ? { id: final.id, scriptVersion: final.scriptVersion } : null}
      user={{ name: user.name, email: user.email, image: user.image ?? null, role: user.role ?? "user" }}
      usage={usage.videos}
      focus={{ tab: query.tab === "edit" ? "edit" : "storyboard", scene, panel: "script" }}
      workerOnline={workerOnline}
    />
  );
}

import { dailyUsage } from "@clipwise/queue";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveVideo } from "@/components/video/live-video";
import { Storyboard } from "@/components/video/storyboard";
import { requireUser } from "@/lib/session";
import { videoForOwner } from "@/lib/videos";

export const metadata: Metadata = { title: "Video" };

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, workspace } = await requireUser();
  const video = await videoForOwner(id, workspace._id);
  if (!video) notFound();
  // Script written and checked: the Storyboard. Anything still running, stopped or failed: the progress view.
  const ready = video.timeline && video.steps.factcheck.state === "done" && video.status === "previewed";
  if (!ready) return <LiveVideo video={video} />;
  const usage = await dailyUsage(user.id);
  return (
    <Storyboard
      video={video}
      user={{ name: user.name, email: user.email, image: user.image ?? null, role: user.role ?? "user" }}
      usage={usage.videos}
    />
  );
}

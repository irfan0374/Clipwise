import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveVideo } from "@/components/video/live-video";
import { requireUser } from "@/lib/session";
import { videoForOwner } from "@/lib/videos";

export const metadata: Metadata = { title: "Video" };

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireUser();
  const video = await videoForOwner(id, workspace._id);
  if (!video) notFound();
  return <LiveVideo video={video} />;
}

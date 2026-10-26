import type { Metadata } from "next";
import { TopBar } from "@/components/app/top-bar";
import { Library } from "@/components/video/library";
import { libraryQuery } from "@/lib/library-query";
import { requireUser } from "@/lib/session";
import { listVideos } from "@/lib/videos";
export const metadata: Metadata = { title: "Your videos" };
export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace } = await requireUser();
  const query = libraryQuery.parse(await searchParams);
  const data = await listVideos(workspace._id, query);
  return (
    <>
      <TopBar title="Your videos" />
      <Library {...data} query={query} />
    </>
  );
}

import { Clapperboard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Videos" };

export default function VideosPage() {
  return (
    <>
      <PageHeader title="Videos" description="Everything you've made, newest first." />
      <EmptyState
        icon={Clapperboard}
        title="No videos yet"
        description="The library arrives in Feature 12. Your first video will show up here."
        action={
          <Button asChild>
            <Link href="/create">Create a video</Link>
          </Button>
        }
      />
    </>
  );
}

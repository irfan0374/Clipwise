import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Create" };

export default function CreatePage() {
  return (
    <>
      <PageHeader
        title="Create a video"
        description="Describe your idea, pick a format and length, and Clipwise writes, voices and animates it."
      />
      <EmptyState
        icon={Sparkles}
        title="The Create screen arrives in Feature 7"
        description="This page shows the app shell: sidebar, page header and content width."
      />
    </>
  );
}

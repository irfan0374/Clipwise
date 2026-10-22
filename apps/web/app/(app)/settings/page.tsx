import { Settings } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Defaults, usage and your account." />
      <EmptyState
        icon={Settings}
        title="Settings arrive in Feature 13"
        description="Default length, voice and format, plus this month's usage."
      />
    </>
  );
}

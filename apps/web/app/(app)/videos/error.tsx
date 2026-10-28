"use client";

import { ErrorPanel } from "@/components/app/error-panel";

export default function VideoError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="px-4 py-8 sm:px-8">
      <ErrorPanel
        error={error}
        retry={retry}
        title="Couldn't load your videos"
        message="Check your connection and try again. Your videos are safe."
      />
    </div>
  );
}

"use client";

import { ErrorPanel } from "@/components/app/error-panel";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="py-8">
      <ErrorPanel error={error} retry={retry} />
    </div>
  );
}

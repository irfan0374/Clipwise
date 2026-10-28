"use client";

import { ErrorPanel } from "@/components/app/error-panel";
import { Logo } from "@/components/app/logo";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-paper p-4">
      <Logo />
      <ErrorPanel error={error} retry={retry} />
    </main>
  );
}

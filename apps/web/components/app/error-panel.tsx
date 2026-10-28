"use client";

import * as Sentry from "@sentry/nextjs";
import { RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * What a page shows when it crashes. Server errors arrive without details (Next.js hides them), only a code that
 * matches the server log and the error report, so we show that code for support.
 */
export function ErrorPanel({
  error,
  retry,
  title = "Something went wrong",
  message = "This page couldn't load. Try again; if it keeps happening, tell us the code below.",
}: {
  error: unknown;
  retry: () => void;
  title?: string;
  message?: string;
}) {
  const digest = error && typeof error === "object" && "digest" in error ? String(error.digest) : null;
  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-xl border border-line bg-panel p-8">
      <span className="grid size-10 place-items-center rounded-full bg-amber-soft text-amber-ink">
        <TriangleAlert className="size-5" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-h2 font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-ink-2">{message}</p>
      {digest && (
        <p className="mt-3 text-xs text-ink-3">
          Error code: <code className="font-mono">{digest}</code>
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => retry()}>
          <RotateCw aria-hidden="true" /> Try again
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/create">Go to Create</Link>
        </Button>
      </div>
    </div>
  );
}

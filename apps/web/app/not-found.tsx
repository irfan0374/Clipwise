import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-paper p-4">
      <Logo />
      <div className="mx-auto max-w-lg rounded-xl border border-line bg-panel p-8 text-center">
        <p className="font-mono text-sm text-ink-3">404</p>
        <h1 className="mt-2 text-h2 font-semibold">This page doesn't exist</h1>
        <p className="mt-2 text-sm text-ink-2">
          The link may be old, or the video was deleted. Check the address or go back to your videos.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/videos">Your videos</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

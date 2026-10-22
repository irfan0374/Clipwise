import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

// Placeholder until the real homepage (Feature 4).
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4">
      <Logo />
      <h1 className="text-h1">Turn any idea into a short video.</h1>
      <p className="text-ink-2">The homepage arrives in Feature 4. Meanwhile, look around the app shell.</p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/create">Open the app</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/design">Design system</Link>
        </Button>
      </div>
    </main>
  );
}

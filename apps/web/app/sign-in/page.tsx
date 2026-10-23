import { AudioLines, Mic, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { getSession } from "@/lib/session";
import { AuthForms } from "./auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (await getSession()) redirect("/create");
  const { tab } = await searchParams;
  const signUp = tab === "sign-up";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px] rounded-2xl border border-line bg-panel p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:p-10">
          <Logo />
          <AuthForms initialTab={signUp ? "sign-up" : "sign-in"} />
          <p className="mt-6 text-center text-small text-ink-3">
            <Link href="/" className="hover:text-ink">
              ← Back to home
            </Link>
          </p>
        </div>
      </section>

      <section
        aria-hidden="true"
        className="relative hidden items-center justify-center overflow-hidden border-l border-line lg:flex"
        style={{ backgroundImage: "radial-gradient(#D6D8CE 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      >
        <div className="absolute size-[420px] rounded-full bg-lime/30 blur-3xl" />
        <div className="relative w-[440px]">
          <svg className="absolute inset-0 size-full overflow-visible" fill="none" aria-hidden="true">
            <path d="M220 150 C 220 210, 90 210, 90 262" stroke="#C9CBC0" strokeDasharray="4 5" />
            <path d="M220 150 C 220 230, 220 260, 220 322" stroke="#C9CBC0" strokeDasharray="4 5" />
            <path d="M220 150 C 220 210, 350 210, 350 262" stroke="#C9CBC0" strokeDasharray="4 5" />
          </svg>
          <div className="relative rounded-2xl border border-line bg-panel p-5 shadow-[0_8px_30px_rgba(15,15,15,0.06)]">
            <p className="mb-2 flex items-center gap-2 text-label font-medium text-ink-3">
              <Sparkles className="size-3.5" /> New video
            </p>
            <p className="font-heading text-h3 text-ink">
              Launch video for our new running shoes
              <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-ink" />
            </p>
          </div>
          <div className="relative mt-24 flex justify-between">
            <span className="flex items-center gap-2 rounded-full border border-line bg-panel px-3.5 py-2 text-small shadow-xs">
              <span className="size-2 rounded-full bg-teal" /> Script ready
            </span>
            <span className="flex items-center gap-2 rounded-full border border-line bg-panel px-3.5 py-2 text-small shadow-xs">
              <AudioLines className="size-4 text-ink-2" /> Captions synced
            </span>
          </div>
          <div className="relative mt-6 flex justify-center">
            <span className="flex items-center gap-2 rounded-full border border-line bg-panel px-3.5 py-2 text-small shadow-xs">
              <Mic className="size-4 text-ink-2" /> Voice: Liam
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

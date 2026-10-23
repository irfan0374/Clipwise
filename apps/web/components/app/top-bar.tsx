import { Bell, CircleHelp, Clapperboard, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { Soon } from "./soon";

/** Stitch top bar: breadcrumb on the left; Upgrade, notifications, help and Generate on the right. */
export function TopBar({ title }: { title: string }) {
  return (
    <header className="z-30 flex h-16 w-full items-center justify-between gap-4 border-b border-line bg-paper px-4 sm:px-6 lg:sticky lg:top-0">
      <div className="flex min-w-0 items-center gap-2 text-[13px]/[18px] text-ink-2">
        <Link href="/videos" className="flex shrink-0 items-center gap-1 transition-colors hover:text-ink">
          <Clapperboard className="size-4" strokeWidth={1.75} />
          <span>Videos</span>
        </Link>
        <span className="text-line">/</span>
        <span className="max-w-md truncate text-[14px]/[20px] font-medium text-ink">{title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden items-center gap-3 sm:flex">
          <Soon>
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-[13px]/[18px] font-medium text-ink"
            >
              <Zap className="size-4 text-teal-ink" strokeWidth={1.75} />
              Upgrade Plan
            </button>
          </Soon>
          <Soon>
            <button
              type="button"
              disabled
              aria-label="Notifications"
              className="grid size-8 place-items-center rounded-lg text-ink-2"
            >
              <Bell className="size-[18px]" strokeWidth={1.75} />
            </button>
          </Soon>
          <Soon>
            <button
              type="button"
              disabled
              aria-label="Help"
              className="grid size-8 place-items-center rounded-lg text-ink-2"
            >
              <CircleHelp className="size-[18px]" strokeWidth={1.75} />
            </button>
          </Soon>
          <span className="h-4 w-px bg-line" />
        </span>
        <Link
          href="/create"
          className="flex items-center gap-1.5 rounded-lg bg-lime px-3.5 py-1.5 text-[13px]/[18px] font-medium text-ink shadow-[0px_4px_16px_rgba(198,244,50,0.35)] transition-all hover:brightness-95 active:scale-[0.98]"
        >
          <Sparkles className="size-4" strokeWidth={1.75} />
          Generate
        </Link>
      </div>
    </header>
  );
}

import { cn } from "cn";
import Link from "next/link";

/** Lime rounded square with a play notch, plus the wordmark. */
export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        className,
      )}
    >
      <span className="grid size-7 place-items-center rounded-lg bg-lime">
        <svg viewBox="0 0 16 16" className="size-3.5 fill-ink" aria-hidden="true">
          <path d="M5 3.5v9l7-4.5z" />
        </svg>
      </span>
      <span className="font-heading text-[17px] font-semibold tracking-[-0.02em] text-ink">Clipwise</span>
    </Link>
  );
}

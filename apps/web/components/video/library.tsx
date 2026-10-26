"use client";
import { Clapperboard, Download, Grid2X2, List, MoreHorizontal, Plus, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { StatusBadge } from "@/components/app/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LibraryQuery } from "@/lib/library-query";
import type { LibraryItem } from "@/lib/videos";

const filters = [
  ["all", "All"],
  ["rendered", "Rendered"],
  ["previewed", "Preview ready"],
  ["in_progress", "In progress"],
  ["failed", "Failed"],
] as const;
export function Library({
  items,
  total,
  all,
  page,
  pages,
  query,
}: {
  items: LibraryItem[];
  total: number;
  all: number;
  page: number;
  pages: number;
  query: LibraryQuery;
}) {
  const router = useRouter();
  const href = (patch: Partial<LibraryQuery>) =>
    `/videos?${new URLSearchParams({ ...query, page: String(page), ...patch, ...(patch.page ? { page: String(patch.page) } : {}) } as Record<string, string>).toString()}`;
  const active = items.some((v) => ["draft", "scripting", "checking", "voicing", "rendering"].includes(v.status));
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [active, router]);
  const button =
    "flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm text-ink-2 hover:bg-wash";
  const grid = query.view === "grid";
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[26px] font-semibold tracking-tight sm:text-[32px]">Your videos</h1>
          <span className="rounded-full border border-line bg-wash px-2 py-0.5 text-xs tabular-nums text-ink-2">
            {all}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form action="/videos" className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-ink-3" />
            <input
              aria-label="Search videos"
              name="q"
              key={query.q}
              defaultValue={query.q}
              placeholder="Search videos"
              maxLength={80}
              className="h-10 w-56 rounded-lg border border-line bg-panel pl-9 pr-3 text-sm"
            />
            <input type="hidden" name="status" value={query.status} />
            <input type="hidden" name="sort" value={query.sort} />
            <input type="hidden" name="view" value={query.view} />
          </form>
          <select
            aria-label="Sort videos"
            value={query.sort}
            onChange={(e) => router.push(href({ sort: e.target.value as LibraryQuery["sort"], page: 1 }))}
            className={button}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <div className="flex rounded-lg border border-line bg-wash p-0.5">
            {(["list", "grid"] as const).map((view) => (
              <Link
                key={view}
                href={href({ view })}
                aria-label={`${view} view`}
                aria-current={query.view === view ? "true" : undefined}
                className={`grid size-9 place-items-center rounded-md ${query.view === view ? "bg-panel shadow-xs" : "text-ink-3"}`}
              >
                {view === "list" ? <List className="size-4" /> : <Grid2X2 className="size-4" />}
              </Link>
            ))}
          </div>
          <Link
            href="/create"
            className="flex h-10 items-center gap-2 rounded-lg bg-lime px-4 text-sm font-semibold shadow-[0_0_20px_rgba(198,244,50,0.25)]"
          >
            <Plus className="size-4" />
            New video
          </Link>
        </div>
      </div>
      <nav aria-label="Filter videos" className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(([status, label]) => (
          <Link
            key={status}
            href={href({ status, page: 1 })}
            aria-current={query.status === status ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${query.status === status ? "border-ink bg-ink text-white" : "border-line bg-panel text-ink-2 hover:bg-wash"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {items.length ? (
        <div
          className={
            grid
              ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "overflow-x-auto rounded-xl border border-line bg-panel shadow-xs"
          }
        >
          {!grid && (
            <div className="grid min-w-[760px] grid-cols-[minmax(240px,1fr)_100px_80px_150px_48px] gap-4 border-b border-line bg-paper/50 px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              <span>Project name</span>
              <span>Format</span>
              <span>Duration</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
          )}
          {items.map((v) => (
            <div
              key={v.id}
              className={
                grid
                  ? "rounded-xl border border-line bg-panel p-4 shadow-xs"
                  : "grid min-w-[760px] grid-cols-[minmax(240px,1fr)_100px_80px_150px_48px] items-center gap-4 border-b border-line px-6 py-3 last:border-b-0 hover:bg-wash/60"
              }
            >
              <Link href={`/videos/${v.id}`} className={`flex min-w-0 items-center gap-4 ${grid ? "mb-4" : ""}`}>
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-paper">
                  {v.thumbnailUrl ? (
                    <Image
                      src={v.thumbnailUrl}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    <Clapperboard className="size-5 text-teal-ink" />
                  )}
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-medium">{v.title}</strong>
                  <span className="text-[11px] text-ink-3">
                    Created{" "}
                    {new Date(v.createdAt).toLocaleDateString("en-GB", {
                      timeZone: "UTC",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </span>
              </Link>
              <span
                className={`w-fit rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] capitalize text-ink-2 ${grid ? "mr-2 inline-block" : ""}`}
              >
                {v.format}
              </span>
              <span className={`text-xs tabular-nums text-ink-2 ${grid ? "mr-3" : ""}`}>
                {v.duration ? `${v.duration}s` : "Auto"}
              </span>
              <div className={grid ? "mt-3 flex items-center justify-between" : ""}>
                <StatusBadge status={v.status} />
                {["voicing", "rendering"].includes(v.status) && (
                  <div
                    role="progressbar"
                    aria-label="Video progress"
                    aria-valuenow={v.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-1.5 h-1 max-w-28 overflow-hidden rounded-full bg-paper"
                  >
                    <div className="h-full bg-linear-to-r from-lime to-teal" style={{ width: `${v.progress}%` }} />
                  </div>
                )}
              </div>
              <div className={`flex justify-end ${grid ? "-mt-7" : ""}`}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-paper"
                    aria-label={`Actions for ${v.title}`}
                  >
                    <MoreHorizontal className="size-5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/videos/${v.id}`}>Open project</Link>
                    </DropdownMenuItem>
                    {v.finalVersion !== null && (
                      <DropdownMenuItem asChild>
                        <a href={`/api/videos/${v.id}/download`}>
                          <Download className="size-4" />
                          Download MP4 (version {v.finalVersion})
                        </a>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-line bg-panel px-6 py-20 text-center">
          <span className="mb-5 grid size-16 place-items-center rounded-2xl border border-line bg-paper">
            <Clapperboard className="size-7 text-teal-ink" />
          </span>
          <h2 className="text-xl font-semibold">{all ? "No videos match" : "Make your first video"}</h2>
          <p className="mt-2 text-sm text-ink-2">
            {all ? "Try another search or status filter." : "Describe an idea and Clipwise does the rest."}
          </p>
          <Link href={all ? "/videos" : "/create"} className="mt-5 rounded-lg bg-lime px-4 py-2 text-sm font-medium">
            {all ? "Clear filters" : "Create video"}
          </Link>
        </div>
      )}
      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-ink-2">
          <span>
            {total} {total === 1 ? "video" : "videos"} · Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className={button}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={href({ page: page + 1 })} className={button}>
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

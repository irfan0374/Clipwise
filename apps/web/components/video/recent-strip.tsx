import { Clapperboard } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/app/status-badge";
import { timeAgo } from "@/lib/time";
import type { RecentVideo } from "@/lib/videos";

export function RecentStrip({ videos }: { videos: RecentVideo[] }) {
  if (!videos.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-h3">Recent</h2>
        <Link href="/videos" className="text-small font-medium text-teal-ink hover:underline">
          All videos
        </Link>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
        {videos.map((v) => (
          <li key={v.id}>
            <Link
              href={`/videos/${v.id}`}
              className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-paper focus-visible:bg-paper"
            >
              <span className="grid h-12 w-[27px] shrink-0 place-items-center overflow-hidden rounded-md bg-ink">
                {v.thumbnailUrl ? (
                  // biome-ignore lint/performance/noImgElement: signed URL from storage, not a static asset
                  <img src={v.thumbnailUrl} alt="" className="size-full object-cover" />
                ) : (
                  <Clapperboard className="size-3.5 text-white/60" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small font-medium text-ink">{v.title}</span>
                <span className="block text-label text-ink-3">{timeAgo(v.createdAt)}</span>
              </span>
              <StatusBadge status={v.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

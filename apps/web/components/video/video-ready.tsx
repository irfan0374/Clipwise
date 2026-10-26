"use client";
import { ArrowLeft, CalendarDays, Check, Copy, Download, Pencil, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Soon } from "@/components/app/soon";
import { TopBar } from "@/components/app/top-bar";
import type { FinalView, VideoView } from "@/lib/videos";

export function VideoReady({ video, final }: { video: VideoView; final: FinalView }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [caption, setCaption] = useState(video.title);
  // Signed playback URLs expire. Refresh them without another generation or render.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 45 * 60 * 1000);
    return () => clearInterval(timer);
  }, [router]);
  const stale = video.scriptVersion !== final.scriptVersion;
  const pill = "rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink-2";
  const download = `/api/videos/${video.id}/download?renderId=${final.id}`;
  return (
    <>
      <TopBar title="Video ready" />
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-6 p-4 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-6 place-items-center rounded-full bg-teal-soft text-teal-ink">
              <Check className="size-3.5" />
            </span>
            <strong className="text-sm">Your video is ready</strong>
            {final.renderMs > 0 && (
              <span className="text-xs text-ink-2">Rendered in {Math.round(final.renderMs / 1000)}s</span>
            )}
          </div>
          <Link href="/videos" className="flex items-center gap-1.5 text-xs text-ink-2 hover:text-ink">
            <ArrowLeft className="size-4" />
            Back to Videos
          </Link>
        </div>
        {stale && (
          <p role="status" className="rounded-lg border border-line bg-panel p-3 text-sm text-ink-2">
            This MP4 uses version {final.scriptVersion}. Your latest edits are in version {video.scriptVersion}. Render
            again from the editor to include them.
          </p>
        )}
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,405px)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[405px] overflow-hidden rounded-3xl border border-line bg-ink shadow-md">
            {final.url && !failed ? (
              <video
                key={final.url}
                aria-label="Completed video"
                controls
                playsInline
                preload="metadata"
                poster={final.thumbnailUrl ?? undefined}
                className="aspect-[9/16] w-full"
                onError={() => setFailed(true)}
              >
                <source src={final.url} type="video/mp4" />
                <track kind="captions" />
                Your browser doesn't support video playback.
              </video>
            ) : (
              <div className="flex aspect-[9/16] flex-col items-center justify-center gap-4 p-8 text-center text-sm text-white">
                <p>
                  {final.url
                    ? "Playback couldn't load. Refresh the link or download the MP4."
                    : "The saved file isn't available. Check storage or render again."}
                </p>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2"
                  onClick={() => {
                    setFailed(false);
                    router.refresh();
                  }}
                >
                  <RefreshCw className="size-4" />
                  Refresh playback
                </button>
              </div>
            )}
          </div>
          <section className="flex flex-col gap-6 rounded-xl border border-line bg-panel p-6 sm:p-7">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{video.title}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={pill}>{(final.durationMs / 1000).toFixed(1)} s</span>
                <span className={pill}>
                  {final.width} × {final.height} · 30fps
                </span>
                <span className={pill}>Voice: {video.voiceName}</span>
                <span className={pill}>{video.format}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {final.url ? (
                <a
                  href={download}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-lime text-sm font-semibold text-ink shadow-[0_0_20px_rgba(198,244,50,0.25)]"
                >
                  <Download className="size-5" />
                  Download MP4
                </a>
              ) : (
                <span className="text-sm text-red-ink">Download unavailable: file missing.</span>
              )}
              <Soon>
                <button
                  type="button"
                  disabled
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line text-sm text-ink-2"
                >
                  <CalendarDays className="size-4" />
                  Schedule to Instagram{" "}
                  <span className="rounded bg-teal-soft px-1.5 text-[10px] text-teal-ink">Soon</span>
                </button>
              </Soon>
              <Link
                href={`/videos/${video.id}?tab=edit`}
                className="flex h-9 items-center justify-center gap-2 rounded-lg text-sm text-ink-2 hover:bg-paper"
              >
                <Pencil className="size-4" />
                Edit and re-render
              </Link>
            </div>
            <div className="rounded-xl border border-line bg-paper/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="post-caption" className="text-sm font-semibold">
                  Post caption
                </label>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-ink-2"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(caption);
                      toast.success("Caption copied");
                    } catch {
                      toast.error("Couldn't copy. Select the text to copy it.");
                    }
                  }}
                >
                  <Copy className="size-3.5" />
                  Copy
                </button>
              </div>
              <textarea
                id="post-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="min-h-24 w-full resize-y rounded-lg border border-line bg-panel p-3 text-sm"
                maxLength={2200}
              />
              <p className="mt-2 text-xs text-ink-3">Draft caption · copy it before leaving this page.</p>
            </div>
            <dl className="divide-y divide-line text-sm">
              {[
                ["Created (UTC)", new Date(final.createdAt).toLocaleString("en-GB", { timeZone: "UTC" })],
                ["Script version", `Version ${final.scriptVersion}`],
                ["File size", `${(final.sizeBytes / 1e6).toFixed(1)} MB`],
                ["Captions", "Included in video"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 py-2.5">
                  <dt className="text-ink-2">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-ink-2">
              {video.format === "promo"
                ? "Confirm product details before publishing."
                : video.steps.factcheck.toReview
                  ? `${video.steps.factcheck.toReview} fact-check notes to review in the editor.`
                  : "Review the video before publishing."}
            </p>
          </section>
        </div>
        <Link
          href="/create"
          className="flex items-center justify-between rounded-xl border border-line bg-panel p-5 text-sm font-medium"
        >
          Make another video <Plus className="size-5" />
        </Link>
      </div>
    </>
  );
}

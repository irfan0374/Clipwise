"use client";
import {
  AlertCircle,
  CalendarCheck,
  ExternalLink,
  Loader2,
  RefreshCw,
  TriangleAlert,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelInstagramPost,
  listVideoPosts,
  postCaption,
  postToInstagram,
  retryInstagramPost,
} from "@/app/(app)/post-actions";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { InstagramForVideo } from "@/lib/instagram";
import { useHydrated } from "@/lib/use-hydrated";
import { dayKey, fromInputs, scheduleProblem, suggestedTime, timeKey, whenText } from "@/lib/when";
import { RescheduleDialog, ScheduleFields } from "./schedule";

// "Post to Instagram" window and the video's Instagram list, from the Stitch "Post to Instagram Modal" and
// "Video Detail" screens: Post now or Schedule (Steps J1–J2).

type Post = InstagramForVideo["posts"][number];
type Account = InstagramForVideo["accounts"][number];
export type PostVideo = { id: string; title: string; durationMs: number; thumbnailUrl: string | null };

export const InstagramIcon = ({ className = "size-4" }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <rect height="20" rx="5" ry="5" width="20" x="2" y="2" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** A post that waits for a later time (not one about to go out). */
const isScheduled = (p: { status: string; publishAt: string }) =>
  p.status === "queued" && new Date(p.publishAt).getTime() > Date.now() + 60_000;

/**
 * The window itself. Opened from the video page ("Post to Instagram") or from the Calendar ("Schedule a video",
 * with Schedule selected and the chosen day filled in).
 */
export function PostDialog({
  video,
  accounts,
  open,
  onOpenChange,
  initialMode = "now",
  initialDay,
  onDone,
}: {
  video: PostVideo;
  accounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "now" | "schedule";
  initialDay?: string;
  onDone?: () => void;
}) {
  const connected = accounts.filter((a) => a.connected);
  const [accountId, setAccountId] = useState(connected[0]?.id ?? "");
  const [caption, setCaption] = useState("");
  const [writing, setWriting] = useState(false);
  const [posting, startPosting] = useTransition();
  const [mode, setMode] = useState(initialMode);
  const [slot, setSlot] = useState<{ day: string; time: string } | null>(null);

  const write = async (rewrite: boolean) => {
    setWriting(true);
    try {
      const res = await postCaption({ videoId: video.id, rewrite });
      if (res.ok) setCaption(res.data.caption);
      else {
        toast.error(res.error.message);
        setCaption((c) => c || video.title);
      }
    } catch {
      toast.error("The AI couldn't write a caption. Write your own or try again.");
      setCaption((c) => c || video.title);
    } finally {
      setWriting(false);
    }
  };

  // Each time the window opens: the saved caption (or one AI request the first time) and a suggested time.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on open only
  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    const suggested = suggestedTime(initialDay);
    setSlot({ day: dayKey(suggested), time: timeKey(suggested) });
    if (!caption) void write(false);
  }, [open]);

  const at = slot ? fromInputs(slot.day, slot.time) : null;
  const problem = mode === "schedule" ? scheduleProblem(at) : null;
  const account = connected.find((a) => a.id === accountId) ?? connected[0];

  const post = () =>
    startPosting(async () => {
      try {
        const res = await postToInstagram({
          videoId: video.id,
          accountId: account?.id ?? "",
          caption,
          publishAt: mode === "schedule" && at ? at.toISOString() : undefined,
        });
        if (!res.ok) toast.error(res.error.message);
        else {
          toast.success(
            mode === "schedule" ? `Scheduled for ${whenText(res.data.publishAt)}` : "Posting to Instagram…",
          );
          onOpenChange(false);
          onDone?.();
        }
      } catch {
        toast.error("Couldn't start posting. Try again.");
      }
    });

  const label = "text-[11px] font-semibold tracking-wider text-ink-2 uppercase";
  const seconds = Math.round(video.durationMs / 1000);
  const tab = (active: boolean) =>
    `flex items-center justify-center gap-1.5 rounded-lg py-2 text-center transition-colors ${
      active ? "bg-ink font-medium text-white" : "text-ink-2 hover:text-ink"
    }`;
  return (
    <Dialog open={open} onOpenChange={(o) => !posting && onOpenChange(o)}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-2rem)] w-[min(760px,calc(100vw-2rem))] flex-col gap-0 p-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl sm:max-w-[760px]"
      >
        {/* Phones: a bottom sheet (Stitch "Post to Instagram (Mobile Sheet)") */}
        <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between px-5 py-3 sm:border-b sm:border-line sm:px-6 sm:py-4">
          <DialogTitle className="font-heading text-lg font-semibold">Post to Instagram</DialogTitle>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            disabled={posting}
            className="rounded-md p-1 text-ink-2 hover:bg-wash"
          >
            <X className="size-5" />
          </button>
        </div>
        <DialogDescription className="sr-only">
          Choose the account, check the caption and post the Reel now or at a later time.
        </DialogDescription>
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 pb-5 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6 sm:p-6">
          <div className="flex items-center gap-3.5 rounded-2xl bg-wash p-3 sm:hidden">
            <div className="relative aspect-[9/16] w-14 shrink-0 overflow-hidden rounded-lg bg-ink">
              {video.thumbnailUrl && (
                // biome-ignore lint/performance/noImgElement: short-lived signed thumbnail URL
                <img src={video.thumbnailUrl} alt="" className="size-full object-cover" />
              )}
              <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                {seconds}s
              </span>
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold">{video.title}</p>
              <p className="mt-0.5 text-xs text-ink-3">1080 × 1920 · 30fps · Reel</p>
            </div>
          </div>
          <div className="hidden w-full sm:block">
            <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-ink">
              {video.thumbnailUrl && (
                // biome-ignore lint/performance/noImgElement: short-lived signed thumbnail URL
                <img src={video.thumbnailUrl} alt="" className="size-full object-cover" />
              )}
              <span className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm font-semibold">{video.title}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className={label}>Post to</span>
              <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-wash text-[11px] font-semibold text-ink-2">
                  {account?.pictureUrl ? (
                    // biome-ignore lint/performance/noImgElement: short-lived Instagram CDN URL
                    <img
                      src={account.pictureUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="size-full object-cover"
                    />
                  ) : (
                    account?.username.slice(0, 2).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <select
                    aria-label="Instagram account"
                    value={account?.id}
                    onChange={(e) => setAccountId(e.target.value)}
                    disabled={connected.length < 2}
                    className="w-full appearance-none truncate bg-transparent text-sm font-semibold outline-none disabled:opacity-100"
                  >
                    {connected.map((a) => (
                      <option key={a.id} value={a.id}>
                        @{a.username}
                      </option>
                    ))}
                  </select>
                  <span className="block text-xs text-ink-3">Instagram professional account</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-medium text-teal-ink">
                  <span className="size-1.5 rounded-full bg-teal" />
                  Connected
                </span>
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="ig-caption" className={label}>
                  Caption
                </label>
                <button
                  type="button"
                  onClick={() => void write(true)}
                  disabled={writing || posting}
                  className="flex items-center gap-1.5 text-xs font-medium text-ink hover:text-teal-ink disabled:opacity-50"
                >
                  {writing ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                  Rewrite caption
                </button>
              </div>
              <textarea
                id="ig-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={2200}
                disabled={writing}
                placeholder={writing ? "Writing a caption…" : "Write a caption"}
                className="min-h-32 w-full resize-y rounded-xl border border-line bg-panel p-3.5 text-sm leading-relaxed outline-none focus:border-ink focus:ring-2 focus:ring-teal/20 disabled:opacity-60"
              />
              <div className="flex justify-between text-xs text-ink-3">
                <span>Written by AI. Edit anything you like.</span>
                <span className="tabular-nums">{caption.length.toLocaleString("en-US")} / 2,200</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className={label}>When</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-wash p-1 text-sm">
                <button
                  type="button"
                  aria-pressed={mode === "now"}
                  onClick={() => setMode("now")}
                  className={tab(mode === "now")}
                >
                  Post now
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "schedule"}
                  onClick={() => setMode("schedule")}
                  className={tab(mode === "schedule")}
                >
                  Schedule
                </button>
              </div>
              {mode === "schedule" && slot && (
                <ScheduleFields day={slot.day} time={slot.time} onChange={setSlot} disabled={posting} />
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line bg-paper px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={posting}
            className="rounded-lg px-4 py-2.5 text-sm text-ink-2 hover:bg-wash max-sm:border max-sm:border-line max-sm:bg-panel max-sm:font-medium max-sm:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={post}
            disabled={posting || writing || !caption.trim() || !account || Boolean(problem)}
            className="flex items-center justify-center gap-2 rounded-lg bg-lime px-5 py-2.5 text-sm font-semibold text-ink shadow-[0_4px_14px_0_rgba(198,244,50,0.35)] disabled:opacity-50 max-sm:flex-1"
          >
            {posting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === "schedule" ? (
              <CalendarCheck className="size-4" />
            ) : (
              <InstagramIcon />
            )}
            {mode === "schedule" ? "Schedule Reel" : "Post now"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The video page button: "Post to Instagram", or a link to connect (or reconnect) an account. */
export function PostToInstagram({ video, instagram }: { video: PostVideo; instagram: InstagramForVideo }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const connected = instagram.accounts.filter((a) => a.connected);
  const button =
    "flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-panel text-sm font-semibold text-ink shadow-2xs transition-colors hover:bg-paper";
  if (!instagram.available) return null;
  if (!connected.length)
    return (
      <Link href="/settings?tab=connections" className={button}>
        <InstagramIcon />
        {instagram.accounts[0] ? `Reconnect @${instagram.accounts[0].username} to post` : "Connect Instagram to post"}
      </Link>
    );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={button}>
        <InstagramIcon />
        Post to Instagram
      </button>
      <PostDialog
        video={video}
        accounts={instagram.accounts}
        open={open}
        onOpenChange={setOpen}
        onDone={() => router.refresh()}
      />
    </>
  );
}

/** The video's Instagram history. Polls while a post is on its way; scheduled posts can be moved or cancelled. */
export function InstagramPosts({ videoId, initial }: { videoId: string; initial: Post[] }) {
  const [posts, setPosts] = useState(initial);
  const [pending, start] = useTransition();
  const [moving, setMoving] = useState<Post | null>(null);
  const hydrated = useHydrated();
  useEffect(() => setPosts(initial), [initial]);
  const active = posts.some((p) => p.status === "publishing" || (p.status === "queued" && !isScheduled(p)));
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      const res = await listVideoPosts({ videoId }).catch(() => null);
      if (res?.ok) {
        const done = res.data.posts.find(
          (p) => p.status === "posted" && posts.find((o) => o.id === p.id)?.status !== "posted",
        );
        if (done) toast.success(`Posted to @${done.username}`);
        setPosts(res.data.posts);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [active, videoId, posts]);
  if (!posts.length) return null;

  const retry = (id: string) =>
    start(async () => {
      try {
        const res = await retryInstagramPost({ postId: id });
        if (!res.ok) toast.error(res.error.message);
        else
          setPosts((list) =>
            list.map((p) =>
              p.id === id ? { ...p, status: "queued", error: null, publishAt: new Date().toISOString() } : p,
            ),
          );
      } catch {
        toast.error("Couldn't retry. Try again.");
      }
    });
  const cancel = (id: string) =>
    start(async () => {
      try {
        const res = await cancelInstagramPost({ postId: id });
        if (!res.ok) toast.error(res.error.message);
        else {
          toast.success("Scheduled post cancelled");
          setPosts((list) => list.filter((p) => p.id !== id));
        }
      } catch {
        toast.error("Couldn't cancel. Try again.");
      }
    });

  const badge = {
    posted: "bg-teal-soft text-teal-ink",
    queued: "border border-teal/40 text-teal-ink",
    scheduled: "border border-teal/40 text-teal-ink",
    publishing: "bg-lime/30 text-ink",
    failed: "bg-red-soft text-red-ink",
    cancelled: "bg-wash text-ink-3",
  } as const;
  const name = {
    posted: "Posted",
    queued: "Queued",
    scheduled: "Scheduled",
    publishing: "Posting…",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return (
    <section className="rounded-xl border border-line bg-panel p-6 sm:p-7" aria-live="polite">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-paper">
          <InstagramIcon className="size-5" />
        </span>
        <div>
          <h2 className="font-heading text-lg font-semibold">Instagram</h2>
          <p className="text-sm text-ink-2">Publication history for this video.</p>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {posts.map((p) => {
          const state = hydrated && isScheduled(p) ? "scheduled" : p.status;
          return (
            <li key={p.id} className="rounded-xl bg-paper px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${badge[state]}`}>
                  {state === "publishing" && <Loader2 className="mr-1 inline size-3 animate-spin" />}
                  {name[state]}
                </span>
                <span className="text-sm text-ink-2">
                  @{p.username}
                  {hydrated && ` · ${state === "scheduled" ? whenText(p.publishAt) : when(p.postedAt ?? p.publishAt)}`}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  {p.status === "posted" && p.permalink && (
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm font-medium text-teal-ink hover:underline"
                    >
                      View on Instagram <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  {state === "scheduled" && (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setMoving(p)}
                        className="rounded-lg bg-panel px-3 py-1.5 text-sm font-medium shadow-2xs disabled:opacity-50"
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => cancel(p.id)}
                        className="rounded-lg px-2 py-1.5 text-sm font-medium text-red-ink hover:bg-red-soft disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {p.status === "failed" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => retry(p.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-panel px-3 py-1.5 text-sm font-medium shadow-2xs disabled:opacity-50"
                    >
                      <RefreshCw className="size-3.5" />
                      Try again
                    </button>
                  )}
                </span>
              </div>
              {p.status === "posted" && p.postedLate && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-ink">
                  <TriangleAlert className="size-3.5" />
                  Posted late, Clipwise was offline at the scheduled time
                </p>
              )}
              {hydrated && state === "queued" && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
                  <Zap className="size-3.5" />
                  Going out now. It posts as soon as Clipwise is online.
                </p>
              )}
              {p.status === "failed" && p.error && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-red-ink">
                  <AlertCircle className="size-3.5" />
                  {p.error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <RescheduleDialog
        post={moving}
        onClose={() => setMoving(null)}
        onDone={(publishAt) => {
          setPosts((list) => list.map((p) => (p.id === moving?.id ? { ...p, publishAt } : p)));
          setMoving(null);
        }}
      />
    </section>
  );
}

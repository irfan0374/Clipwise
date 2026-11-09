"use client";
import { AlertCircle, ExternalLink, Loader2, RefreshCw, TriangleAlert, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { listVideoPosts, postCaption, postToInstagram, retryInstagramPost } from "@/app/(app)/post-actions";
import { Soon } from "@/components/app/soon";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { InstagramForVideo } from "@/lib/instagram";

// "Post to Instagram" window and the video's Instagram list, from the Stitch "Post to Instagram Modal" and
// "Video Detail" screens. Step J1: Post now (Schedule arrives in Step J2).

type Post = InstagramForVideo["posts"][number];

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

export function PostToInstagram({
  videoId,
  title,
  durationMs,
  thumbnailUrl,
  instagram,
  fallbackCaption,
}: {
  videoId: string;
  title: string;
  durationMs: number;
  thumbnailUrl: string | null;
  instagram: InstagramForVideo;
  fallbackCaption: string;
}) {
  const router = useRouter();
  const connected = instagram.accounts.filter((a) => a.connected);
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(connected[0]?.id ?? "");
  const [caption, setCaption] = useState("");
  const [writing, setWriting] = useState(false);
  const [posting, startPosting] = useTransition();

  const write = async (rewrite: boolean) => {
    setWriting(true);
    try {
      const res = await postCaption({ videoId, rewrite });
      if (res.ok) setCaption(res.data.caption);
      else {
        toast.error(res.error.message);
        setCaption((c) => c || fallbackCaption);
      }
    } catch {
      toast.error("The AI couldn't write a caption. Write your own or try again.");
      setCaption((c) => c || fallbackCaption);
    } finally {
      setWriting(false);
    }
  };

  const openWindow = () => {
    if (!connected.length) return;
    setAccountId((id) => id || connected[0]?.id || "");
    setOpen(true);
    if (!caption) void write(false); // the saved caption, or one AI request the first time
  };

  const post = () =>
    startPosting(async () => {
      try {
        const res = await postToInstagram({ videoId, accountId, caption });
        if (!res.ok) toast.error(res.error.message);
        else {
          toast.success("Posting to Instagram…");
          setOpen(false);
          router.refresh();
        }
      } catch {
        toast.error("Couldn't start posting. Try again.");
      }
    });

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

  const account = connected.find((a) => a.id === accountId) ?? connected[0];
  const label = "text-[11px] font-semibold tracking-wider text-ink-2 uppercase";
  return (
    <>
      <button type="button" onClick={openWindow} className={button}>
        <InstagramIcon />
        Post to Instagram
      </button>
      <Dialog open={open} onOpenChange={(o) => !posting && setOpen(o)}>
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
              onClick={() => setOpen(false)}
              disabled={posting}
              className="rounded-md p-1 text-ink-2 hover:bg-wash"
            >
              <X className="size-5" />
            </button>
          </div>
          <DialogDescription className="sr-only">
            Choose the account, check the caption and post the Reel.
          </DialogDescription>
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 pb-5 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6 sm:p-6">
            <div className="flex items-center gap-3.5 rounded-2xl bg-wash p-3 sm:hidden">
              <div className="relative aspect-[9/16] w-14 shrink-0 overflow-hidden rounded-lg bg-ink">
                {thumbnailUrl && (
                  // biome-ignore lint/performance/noImgElement: short-lived signed thumbnail URL
                  <img src={thumbnailUrl} alt="" className="size-full object-cover" />
                )}
                <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                  {Math.round(durationMs / 1000)}s
                </span>
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs text-ink-3">1080 × 1920 · 30fps · Reel</p>
              </div>
            </div>
            <div className="hidden w-full sm:block">
              <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-ink">
                {thumbnailUrl && (
                  // biome-ignore lint/performance/noImgElement: short-lived signed thumbnail URL
                  <img src={thumbnailUrl} alt="" className="size-full object-cover" />
                )}
                <span className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
                  0:{String(Math.round(durationMs / 1000)).padStart(2, "0")}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm font-semibold">{title}</p>
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
              <div className="flex flex-col gap-2">
                <span className={label}>When</span>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-wash p-1 text-sm">
                  <span className="rounded-lg bg-ink py-2 text-center font-medium text-white">Post now</span>
                  <Soon label="Scheduling is coming next">
                    <span className="w-full rounded-lg py-2 text-center text-ink-3">Schedule</span>
                  </Soon>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line bg-paper px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={posting}
              className="rounded-lg px-4 py-2.5 text-sm text-ink-2 hover:bg-wash max-sm:border max-sm:border-line max-sm:bg-panel max-sm:font-medium max-sm:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={post}
              disabled={posting || writing || !caption.trim() || !account}
              className="flex items-center justify-center gap-2 rounded-lg bg-lime px-5 py-2.5 text-sm font-semibold max-sm:flex-1 text-ink shadow-[0_4px_14px_0_rgba(198,244,50,0.35)] disabled:opacity-50"
            >
              {posting ? <Loader2 className="size-4 animate-spin" /> : <InstagramIcon />}
              Post now
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The video's Instagram history. Polls while a post is on its way. */
export function InstagramPosts({ videoId, initial }: { videoId: string; initial: Post[] }) {
  const [posts, setPosts] = useState(initial);
  const [pending, start] = useTransition();
  useEffect(() => setPosts(initial), [initial]);
  const active = posts.some((p) => p.status === "queued" || p.status === "publishing");
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
        else setPosts((list) => list.map((p) => (p.id === id ? { ...p, status: "queued", error: null } : p)));
      } catch {
        toast.error("Couldn't retry. Try again.");
      }
    });

  const badge = {
    posted: "bg-teal-soft text-teal-ink",
    queued: "border border-teal/40 text-teal-ink",
    publishing: "bg-lime/30 text-ink",
    failed: "bg-red-soft text-red-ink",
    cancelled: "bg-wash text-ink-3",
  } as const;
  const name = { posted: "Posted", queued: "Queued", publishing: "Posting…", failed: "Failed", cancelled: "Cancelled" };
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
        {posts.map((p) => (
          <li key={p.id} className="rounded-xl bg-paper px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${badge[p.status]}`}>
                {p.status === "publishing" && <Loader2 className="mr-1 inline size-3 animate-spin" />}
                {name[p.status]}
              </span>
              <span className="text-sm text-ink-2">
                @{p.username} · {when(p.postedAt ?? p.publishAt)}
              </span>
              <span className="ml-auto">
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
            {p.status === "failed" && p.error && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-red-ink">
                <AlertCircle className="size-3.5" />
                {p.error}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

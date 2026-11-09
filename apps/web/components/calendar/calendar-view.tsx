"use client";
import type { CalendarPost, PostableVideo } from "@clipwise/queue";
import { cn } from "cn";
import {
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crosshair,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelInstagramPost, listCalendarPosts, listPostableVideos } from "@/app/(app)/post-actions";
import { Soon } from "@/components/app/soon";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { InstagramIcon, PostDialog, type PostVideo } from "@/components/video/post-instagram";
import { RescheduleDialog } from "@/components/video/schedule";
import type { instagramAccounts } from "@/lib/instagram";
import { useHydrated } from "@/lib/use-hydrated";
import { clockText, dayKey } from "@/lib/when";

// The Calendar (Stitch "Clipwise — Calendar" and "Calendar (Mobile)"): a month of Instagram posts, the chosen day's
// posts with Reschedule / Cancel, and "Schedule a video". Days follow the viewer's time zone.

type Instagram = Awaited<ReturnType<typeof instagramAccounts>>;
type Filter = "all" | "scheduled" | "posted" | "failed";
type Kind = "scheduled" | "sending" | "posted" | "failed";

const kindOf = (p: CalendarPost): Kind =>
  p.status === "posted"
    ? "posted"
    : p.status === "failed"
      ? "failed"
      : p.status === "publishing" || new Date(p.publishAt).getTime() <= Date.now() + 60_000
        ? "sending"
        : "scheduled";
const inFilter = (k: Kind, f: Filter) =>
  f === "all" || (f === "scheduled" ? k === "scheduled" || k === "sending" : k === f);

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const chip: Record<Kind, string> = {
  scheduled: "border border-line bg-panel text-ink",
  sending: "bg-lime/30 text-ink",
  posted: "bg-teal-soft text-teal-ink",
  failed: "bg-red-soft text-red-ink",
};
const dot: Record<Kind, string> = {
  scheduled: "bg-teal/50",
  sending: "bg-lime",
  posted: "bg-teal-ink",
  failed: "bg-red-ink",
};
const KindIcon = ({ kind, className = "size-3" }: { kind: Kind; className?: string }) =>
  kind === "posted" ? (
    <CheckCircle2 className={className} />
  ) : kind === "failed" ? (
    <TriangleAlert className={className} />
  ) : kind === "sending" ? (
    <Loader2 className={cn(className, "animate-spin")} />
  ) : (
    <Clock className={className} />
  );

export function CalendarView({ instagram }: { instagram: Instagram }) {
  const hydrated = useHydrated();
  const [month, setMonth] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("all");
  const [accountId, setAccountId] = useState("all");
  const [data, setData] = useState<{ posts: CalendarPost[]; waiting: number; maxWaiting: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const [moving, setMoving] = useState<CalendarPost | null>(null);
  const [picking, setPicking] = useState<{ day?: string } | null>(null);
  const [posting, setPosting] = useState<{ video: PostVideo; day?: string } | null>(null);
  const [pending, start] = useTransition();
  const connected = instagram.accounts.filter((a) => a.connected);
  const today = hydrated ? dayKey(new Date()) : "";

  useEffect(() => {
    if (!hydrated || month) return;
    setMonth(monthStart(new Date()));
    setSelected(dayKey(new Date()));
  }, [hydrated, month]);

  // The visible weeks, Monday first.
  const grid = useMemo(() => {
    if (!month) return [];
    const first = addDays(month, -((month.getDay() + 6) % 7));
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const weeks = Math.ceil((((month.getDay() + 6) % 7) + days) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i));
  }, [month]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` reloads the month after a change
  useEffect(() => {
    if (!grid.length) return;
    let live = true;
    setLoading(true);
    listCalendarPosts({ from: grid[0]!.toISOString(), to: addDays(grid[grid.length - 1]!, 1).toISOString() })
      .then((res) => {
        if (!live) return;
        if (res.ok) setData(res.data);
        else toast.error(res.error.message);
      })
      .catch(() => live && toast.error("Couldn't load the calendar. Try again."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [grid, version]);

  // Posts going out right now: check again until they finish.
  const sending = data?.posts.some((p) => kindOf(p) === "sending");
  useEffect(() => {
    if (!sending) return;
    const timer = setInterval(refresh, 8000);
    return () => clearInterval(timer);
  }, [sending, refresh]);

  const posts = useMemo(
    () => (data?.posts ?? []).filter((p) => accountId === "all" || p.accountId === accountId),
    [data, accountId],
  );
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    for (const p of posts) {
      const key = dayKey(new Date(p.publishAt));
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [posts]);
  const inMonth = month ? posts.filter((p) => new Date(p.publishAt).getMonth() === month.getMonth()) : [];
  const counts = {
    all: inMonth.length,
    scheduled: inMonth.filter((p) => inFilter(kindOf(p), "scheduled")).length,
    posted: inMonth.filter((p) => kindOf(p) === "posted").length,
    failed: inMonth.filter((p) => kindOf(p) === "failed").length,
  };
  const dayPosts = (byDay.get(selected) ?? []).filter((p) => inFilter(kindOf(p), filter));

  const go = (n: number) => month && setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const goToday = () => {
    setMonth(monthStart(new Date()));
    setSelected(dayKey(new Date()));
  };
  const pick = (d: Date) => {
    setSelected(dayKey(d));
    if (month && d.getMonth() !== month.getMonth()) setMonth(monthStart(d));
  };
  const cancel = (id: string) =>
    start(async () => {
      try {
        const res = await cancelInstagramPost({ postId: id });
        if (!res.ok) toast.error(res.error.message);
        else {
          toast.success("Scheduled post cancelled");
          refresh();
        }
      } catch {
        toast.error("Couldn't cancel. Try again.");
      }
    });
  const schedule = (day?: string) => setPicking({ day });

  const canSchedule = instagram.available && connected.length > 0;
  const monthName = month?.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) ?? "";
  const selectedDate = selected ? new Date(`${selected}T12:00:00`) : null;
  const longDay = (d: Date) =>
    `${d.toLocaleDateString("en-GB", { weekday: "long" })}, ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  const selectedTitle = selectedDate ? longDay(selectedDate) : null;
  const waitingDay = dayPosts.filter((p) => kindOf(p) === "scheduled").length;
  const nextDay = [...byDay.keys()].sort().find((k) => k > selected && k >= today);

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 p-4 pb-28 sm:p-8 lg:pb-8">
      <header className="flex items-center justify-between gap-4 lg:flex-wrap lg:items-start xl:flex-nowrap">
        <div>
          <h1 className="flex items-center gap-1 text-[26px] font-semibold tracking-tight sm:text-[32px]">
            Calendar
            <span className="mt-3 size-1.5 rounded-full bg-teal lg:hidden" />
          </h1>
          <p className="mt-1 max-w-60 text-sm text-ink-2 max-lg:hidden">
            Schedule and publish your Reels to Instagram.
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-2.5 lg:flex-wrap">
          <div className="flex h-11 items-center gap-1 rounded-xl border border-line bg-panel px-1.5 shadow-2xs max-lg:hidden">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => go(-1)}
              className="rounded-md p-1.5 hover:bg-wash"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-32 text-center text-sm font-semibold">{monthName}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => go(1)}
              className="rounded-md p-1.5 hover:bg-wash"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="flex h-11 items-center rounded-xl border border-line bg-panel p-1 text-sm shadow-2xs max-lg:hidden">
            <span className="rounded-lg bg-ink px-3 py-1.5 font-medium text-white">Month</span>
            <Soon label="Week view is coming soon">
              <span className="px-3 py-1.5 text-ink-3">Week</span>
            </Soon>
          </div>
          {instagram.accounts.length > 0 && (
            <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-sm shadow-2xs">
              <InstagramIcon className="size-4 text-ink-2" />
              <span className="sr-only">Instagram account</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="max-w-40 appearance-none truncate bg-transparent font-medium outline-none"
              >
                {instagram.accounts.length > 1 && <option value="all">All accounts</option>}
                {instagram.accounts.map((a) => (
                  <option key={a.id} value={instagram.accounts.length > 1 ? a.id : "all"}>
                    @{a.username}
                  </option>
                ))}
              </select>
              <span className={cn("size-2 rounded-full", connected.length ? "bg-teal" : "bg-amber-ink")} />
            </label>
          )}
          {canSchedule && (
            <button
              type="button"
              onClick={() => schedule()}
              className="flex h-11 items-center gap-2 rounded-xl bg-lime px-5 text-sm font-semibold text-ink shadow-[0_4px_14px_0_rgba(198,244,50,0.35)] hover:brightness-105 max-lg:hidden"
            >
              <Plus className="size-4" />
              Schedule a video
            </button>
          )}
        </div>
      </header>

      {!canSchedule && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-4 text-sm">
          <span className="flex items-center gap-2.5 text-ink-2">
            <InstagramIcon className="size-5 text-ink" />
            {!instagram.available
              ? "Instagram posting isn't set up on this server yet."
              : instagram.accounts.length
                ? `Reconnect @${instagram.accounts[0]!.username} to schedule new posts.`
                : "Connect your Instagram account to schedule posts."}
          </span>
          {instagram.available && (
            <Link
              href="/settings?tab=connections"
              className="rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-white hover:bg-ink/90"
            >
              {instagram.accounts.length ? "Reconnect" : "Connect Instagram"}
            </Link>
          )}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-3xl border border-line bg-panel p-4 shadow-2xs sm:p-6">
          {/* Phones: month name and arrows inside the card (Stitch mobile) */}
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => go(-1)}
                className="rounded-md p-1.5 hover:bg-wash"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-lg font-semibold whitespace-nowrap max-[360px]:text-base">{monthName}</span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => go(1)}
                className="rounded-md p-1.5 hover:bg-wash"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={goToday}
              className="flex items-center gap-1.5 rounded-lg bg-wash px-3 py-1.5 text-sm font-medium"
            >
              <span className="size-1.5 rounded-full bg-lime" />
              Today
            </button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-3 max-lg:hidden">
            <button
              type="button"
              onClick={goToday}
              className="flex items-center gap-2 rounded-xl bg-wash px-3.5 py-2 text-sm font-medium hover:bg-line/60"
            >
              <Crosshair className="size-4" />
              Today
            </button>
            <div className="flex rounded-xl bg-wash p-1 text-xs font-medium">
              {(["all", "scheduled", "posted", "failed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 capitalize transition-colors",
                    filter === f ? "bg-panel text-ink shadow-2xs" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {f} ({counts[f]})
                </button>
              ))}
            </div>
            {loading && <Loader2 className="size-4 animate-spin text-ink-3" />}
          </div>
          <Legend className="mb-5 max-lg:hidden" />

          <div className="grid grid-cols-7 gap-1.5 rounded-xl text-center text-[11px] font-semibold tracking-wider text-ink-3 uppercase lg:mb-3 lg:bg-wash lg:py-2.5">
            {weekdays.map((d) => (
              <span key={d}>
                <span className="lg:hidden">{d[0]}</span>
                <span className="max-lg:hidden">{d}</span>
              </span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 lg:mt-0 lg:gap-2">
            {!month &&
              Array.from({ length: 35 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholders before the browser knows the month
                <div key={i} className="aspect-square rounded-2xl bg-paper lg:aspect-auto lg:h-28" />
              ))}
            {grid.map((d) => {
              const key = dayKey(d);
              const all = (byDay.get(key) ?? []).filter((p) => inFilter(kindOf(p), filter));
              const outside = month && d.getMonth() !== month.getMonth();
              const isToday = key === today;
              const isSelected = key === selected;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(d)}
                  aria-pressed={isSelected}
                  aria-label={`${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, ${all.length} ${all.length === 1 ? "post" : "posts"}`}
                  className={cn(
                    "flex flex-col items-center rounded-2xl text-left transition-colors lg:h-28 lg:items-stretch lg:p-2.5",
                    "max-lg:py-1.5",
                    outside ? "opacity-40" : "",
                    "lg:bg-paper lg:hover:bg-wash",
                    isSelected && "lg:bg-panel lg:shadow-md lg:ring-1 lg:ring-line",
                  )}
                >
                  {/* number */}
                  <span className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm tabular-nums lg:size-7",
                        isToday && "bg-lime font-semibold text-ink",
                        !isToday && isSelected && "max-lg:bg-ink max-lg:text-white",
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {isToday && (
                      <span className="rounded-md bg-lime/30 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-ink uppercase max-lg:hidden">
                        Today
                      </span>
                    )}
                    {all.length > 2 && (
                      <span className="rounded-md bg-teal-soft px-1.5 text-[11px] font-semibold text-teal-ink max-lg:hidden">
                        {all.length}
                      </span>
                    )}
                  </span>
                  {/* computer: time chips */}
                  <span className="mt-auto flex flex-col gap-1 max-lg:hidden">
                    {all.slice(0, 2).map((p) => {
                      const k = kindOf(p);
                      return (
                        <span
                          key={p.id}
                          className={cn(
                            "flex items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-[11px] font-medium",
                            chip[k],
                          )}
                        >
                          <KindIcon kind={k} />
                          {clockText(p.publishAt)}
                        </span>
                      );
                    })}
                    {all.length > 2 && (
                      <span className="rounded-md bg-wash px-1.5 py-0.5 text-[11px] font-medium text-ink-2">
                        +{all.length - 2} more
                      </span>
                    )}
                  </span>
                  {/* phone: dots */}
                  <span className="mt-1 flex h-1.5 gap-0.5 lg:hidden">
                    {all.slice(0, 3).map((p) => (
                      <span key={p.id} className={cn("size-1.5 rounded-full", dot[kindOf(p)])} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <Legend className="mt-4 justify-center rounded-xl bg-paper py-2.5 lg:hidden" />

          {data && (
            <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl bg-paper p-4 max-lg:hidden">
              <span className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-panel shadow-2xs">
                  <TrendingUp className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">This month</span>
                  <span className="text-xs text-ink-2">
                    {counts.scheduled} scheduled · {counts.posted} posted · {counts.failed} failed
                  </span>
                </span>
              </span>
              <span className="ml-auto flex min-w-56 items-center gap-4">
                <span className="text-right">
                  <span className="block text-[11px] text-ink-3">Waiting to post</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {data.waiting} / {data.maxWaiting}
                  </span>
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-lime to-teal"
                    style={{ width: `${Math.min(100, (data.waiting / data.maxWaiting) * 100)}%` }}
                  />
                </span>
              </span>
            </div>
          )}
        </section>

        {/* The chosen day */}
        <aside
          className={cn(
            "flex flex-col gap-4 lg:rounded-3xl lg:border lg:border-line lg:bg-panel lg:p-5 lg:shadow-2xs",
            !selected && "invisible",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold lg:text-xl">
                {selectedTitle ?? " "}
                {selected && selected === today && (
                  <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-white lg:bg-lime lg:text-ink">
                    Today
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-sm text-ink-2 max-lg:hidden">
                {waitingDay
                  ? `${waitingDay} ${waitingDay === 1 ? "video" : "videos"} queued for release`
                  : dayPosts.length
                    ? `${dayPosts.length} ${dayPosts.length === 1 ? "post" : "posts"}`
                    : "No posts on this day"}
              </p>
            </div>
            {waitingDay > 0 && (
              <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-medium text-teal-ink lg:hidden">
                {waitingDay} queued
              </span>
            )}
          </div>

          {dayPosts.map((p) => (
            <DayCard key={p.id} post={p} busy={pending} onMove={() => setMoving(p)} onCancel={() => cancel(p.id)} />
          ))}

          {selected && !dayPosts.length && (
            <div className="flex flex-col items-center rounded-2xl bg-paper px-5 py-7 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-panel shadow-2xs">
                <CalendarX2 className="size-5 text-ink-2" />
              </span>
              <p className="mt-3 text-sm font-semibold">Nothing scheduled</p>
              <p className="mt-1 text-xs text-ink-2">No videos set to publish on this date.</p>
              {canSchedule && selected >= today && (
                <button
                  type="button"
                  onClick={() => schedule(selected)}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-panel px-4 py-2 text-sm font-medium shadow-2xs hover:bg-wash"
                >
                  <Plus className="size-4" />
                  Schedule a video
                </button>
              )}
            </div>
          )}

          {nextDay && (
            <button
              type="button"
              onClick={() => pick(new Date(`${nextDay}T12:00:00`))}
              className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-3.5 text-left lg:hidden"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-wash text-sm font-semibold">
                {Number(nextDay.slice(8))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{longDay(new Date(`${nextDay}T12:00:00`))}</span>
                <span className="text-xs text-ink-2">
                  {byDay.get(nextDay)?.length} {byDay.get(nextDay)?.length === 1 ? "post" : "posts"} ·{" "}
                  {clockText(byDay.get(nextDay)?.[0]?.publishAt ?? new Date())}
                </span>
              </span>
              <ChevronRight className="size-4 text-ink-3" />
            </button>
          )}
        </aside>
      </div>

      {/* Phones: the main action stays in reach */}
      {canSchedule && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-paper via-paper/95 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
          <button
            type="button"
            onClick={() => schedule(selected && selected >= today ? selected : undefined)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lime text-base font-semibold text-ink shadow-[0_4px_14px_0_rgba(198,244,50,0.35)]"
          >
            <Plus className="size-5" />
            Schedule a video
          </button>
        </div>
      )}

      <RescheduleDialog
        post={moving}
        onClose={() => setMoving(null)}
        onDone={() => {
          setMoving(null);
          refresh();
        }}
      />
      <VideoPicker
        open={Boolean(picking)}
        onClose={() => setPicking(null)}
        onPick={(video) => {
          setPosting({ video, day: picking?.day });
          setPicking(null);
        }}
      />
      {posting && (
        <PostDialog
          key={posting.video.id}
          video={posting.video}
          accounts={instagram.accounts}
          open
          onOpenChange={(o) => !o && setPosting(null)}
          initialMode="schedule"
          initialDay={posting.day}
          onDone={refresh}
        />
      )}
    </div>
  );
}

function Legend({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 text-xs font-medium text-ink-2", className)}>
      {(
        [
          ["scheduled", "Scheduled"],
          ["posted", "Posted"],
          ["failed", "Failed"],
        ] as const
      ).map(([k, label]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", dot[k])} />
          {label}
        </span>
      ))}
    </div>
  );
}

function DayCard({
  post,
  busy,
  onMove,
  onCancel,
}: {
  post: CalendarPost;
  busy: boolean;
  onMove: () => void;
  onCancel: () => void;
}) {
  const k = kindOf(post);
  const seconds = Math.round(post.durationMs / 1000);
  const label = { scheduled: "Scheduled", sending: "Posting…", posted: "Posted", failed: "Failed" }[k];
  return (
    <article className="rounded-2xl border border-line bg-panel p-3.5 shadow-2xs lg:border-0 lg:bg-paper lg:shadow-none">
      <div className="flex gap-3.5">
        <Link
          href={`/videos/${post.videoId}`}
          className="relative aspect-[9/16] w-16 shrink-0 overflow-hidden rounded-xl bg-ink lg:w-14"
        >
          {post.thumbnailUrl && (
            // biome-ignore lint/performance/noImgElement: short-lived signed thumbnail URL
            <img src={post.thumbnailUrl} alt="" className="size-full object-cover" />
          )}
          <span className="absolute top-1 left-1 rounded-md bg-black/40 p-0.5 text-white">
            <InstagramIcon className="size-3" />
          </span>
          <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white tabular-nums">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                chip[k],
                k === "scheduled" && "border-0 bg-teal-soft text-teal-ink",
              )}
            >
              <KindIcon kind={k} />
              {label}
            </span>
            <span className="text-xs font-medium text-ink-2 tabular-nums">{clockText(post.publishAt)}</span>
          </div>
          <Link href={`/videos/${post.videoId}`} className="line-clamp-2 text-sm font-semibold hover:underline">
            {post.title}
          </Link>
          <span className="flex items-center gap-1.5 text-xs text-ink-2">
            <Clock className="size-3.5" />
            {k === "posted"
              ? `Posted ${clockText(post.postedAt ?? post.publishAt)} · @${post.username}`
              : `IG Reels · @${post.username}`}
          </span>
          {post.postedLate && k === "posted" && (
            <span className="text-xs text-amber-ink">Posted late, Clipwise was offline at the time</span>
          )}
          {k === "failed" && post.error && <span className="text-xs text-red-ink">{post.error}</span>}
        </div>
      </div>
      {(k === "scheduled" || k === "posted" || k === "failed") && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {k === "scheduled" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onMove}
                className="flex items-center gap-1.5 rounded-lg bg-wash px-3 py-1.5 text-sm font-medium hover:bg-line/60 disabled:opacity-50 lg:bg-panel lg:shadow-2xs"
              >
                <Pencil className="size-3.5" />
                Reschedule
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="rounded-lg px-2 py-1.5 text-sm font-medium text-red-ink hover:bg-red-soft disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}
          {k === "posted" && post.permalink && (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-teal-ink hover:underline"
            >
              View on Instagram <ExternalLink className="size-3.5" />
            </a>
          )}
          {k === "failed" && (
            <Link
              href={`/videos/${post.videoId}`}
              className="rounded-lg bg-wash px-3 py-1.5 text-sm font-medium hover:bg-line/60 lg:bg-panel lg:shadow-2xs"
            >
              Open video to try again
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

/** "Schedule a video": pick one of the finished videos. */
function VideoPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (video: PostableVideo) => void;
}) {
  const [videos, setVideos] = useState<PostableVideo[] | null>(null);
  useEffect(() => {
    if (!open || videos) return;
    listPostableVideos({})
      .then((res) => (res.ok ? setVideos(res.data.videos) : toast.error(res.error.message)))
      .catch(() => toast.error("Couldn't load your videos. Try again."));
  }, [open, videos]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="border-b border-line px-5 py-4">
          <DialogTitle className="font-heading text-lg font-semibold">Schedule a video</DialogTitle>
          <DialogDescription className="text-sm text-ink-2">
            Choose a finished video to post to Instagram.
          </DialogDescription>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto p-5">
          {!videos && (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-ink-3" />
            </div>
          )}
          {videos?.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center text-sm">
              <CalendarDays className="size-6 text-ink-3" />
              <p className="mt-3 font-semibold">No finished videos yet</p>
              <p className="mt-1 text-ink-2">Render a video first, then schedule it here.</p>
              <Link href="/create" className="mt-4 rounded-lg bg-ink px-4 py-2 font-medium text-white">
                Make a video
              </Link>
            </div>
          )}
          {videos && videos.length > 0 && (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {videos.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => onPick(v)}
                    className="group flex w-full flex-col gap-2 text-left"
                  >
                    <span className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-ink ring-lime transition group-hover:ring-2">
                      {v.thumbnailUrl && (
                        // biome-ignore lint/performance/noImgElement: short-lived signed thumbnail URL
                        <img src={v.thumbnailUrl} alt="" className="size-full object-cover" />
                      )}
                      <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                        {Math.round(v.durationMs / 1000)}s
                      </span>
                    </span>
                    <span className="line-clamp-2 text-xs font-medium">{v.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

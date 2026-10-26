"use client";

import type { Stage, VideoEvent, VideoStatus } from "@clipwise/shared";
import { cn } from "cn";
import { AlertCircle, Check, Info, Loader2, Lock, Maximize, Ratio, RotateCcw, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { cancelVideo, retryVideo } from "@/app/(app)/actions";
import { TopBar } from "@/components/app/top-bar";
import type { StepState, VideoView } from "@/lib/videos";

const secs = (ms: number | null) => (ms == null ? "" : ` · ${Math.max(1, Math.round(ms / 1000))}s`);
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const working: VideoStatus[] = ["draft", "scripting", "checking", "voicing", "rendering"];

type Row = { title: string; meta: ReactNode; state: StepState | "locked"; n: number; extra?: ReactNode };

const rowLabel: Record<Row["state"], ReactNode> = {
  done: <span className="text-[11px]/[14px] font-semibold tracking-[0.02em] text-teal-ink">Done</span>,
  active: (
    <span className="rounded-full bg-[#6df5e1]/40 px-2 py-0.5 text-[11px]/[14px] font-semibold tracking-[0.02em] text-teal-ink">
      In Progress
    </span>
  ),
  failed: (
    <span className="rounded-full bg-red-soft px-2 py-0.5 text-[11px]/[14px] font-semibold tracking-[0.02em] text-red-ink">
      Failed
    </span>
  ),
  waiting: <span className="text-[11px]/[14px] font-medium tracking-[0.02em] text-[#c4c9ae]">Pending</span>,
  locked: <span className="text-[11px]/[14px] font-medium tracking-[0.02em] text-[#c4c9ae]/70">Locked</span>,
};

/** One step of the vertical stepper, styled per state as in the Stitch Generating screen. */
function StepRow({ title, meta, state, n, extra }: Row) {
  const active = state === "active";
  return (
    <div
      className={cn(
        "relative z-10 flex items-start gap-4",
        active && "-mx-3 rounded-lg border border-line bg-paper/70 p-3",
      )}
    >
      {state === "done" ? (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal-ink text-white shadow-xs">
          <Check className="size-[17px]" strokeWidth={3} />
        </span>
      ) : active ? (
        <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-lime bg-panel shadow-xs">
          <span className="spin-slow size-3 rounded-full bg-lime" />
        </span>
      ) : state === "failed" ? (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-red-soft text-red">
          <AlertCircle className="size-[17px]" strokeWidth={2} />
        </span>
      ) : state === "locked" ? (
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-wash text-[#c4c9ae]">
          <Lock className="size-[15px]" strokeWidth={1.75} />
        </span>
      ) : (
        <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-line bg-panel text-[12px] font-semibold text-ink-3">
          {n}
        </span>
      )}
      <div className={cn("min-w-0 flex-1", !active && "pt-1")}>
        <div className="flex items-center justify-between gap-3">
          <h3
            className={cn(
              "flex items-center gap-2 font-sans text-[14px]/[20px]",
              state === "waiting"
                ? "font-normal text-ink/70"
                : state === "locked"
                  ? "font-normal text-ink/50"
                  : "font-medium text-ink",
            )}
          >
            {title}
            {active && <span className="pulse-soft size-1.5 rounded-full bg-[#506600]" />}
          </h3>
          {rowLabel[state]}
        </div>
        <div
          className={cn(
            "mt-0.5 text-[13px]/[18px] tabular-nums",
            state === "waiting" ? "text-ink-2/70" : state === "locked" ? "text-ink-2/50" : "text-ink-2",
          )}
        >
          {meta}
        </div>
        {extra}
      </div>
    </div>
  );
}

/** The Generating screen: live steps (server-sent events), cancel/retry, and a placeholder 9:16 preview. */
export function LiveVideo({ video }: { video: VideoView }) {
  const router = useRouter();
  const [live, setLive] = useState<{ status: VideoStatus; stage: Stage | null; progress: number }>({
    status: video.status,
    stage: video.stage,
    progress: video.progress,
  });
  const [detail, setDetail] = useState<Partial<Record<Stage, string>>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Server data is the source of truth; events just make the page feel instant and trigger a refresh.
  useEffect(() => {
    setLive({ status: video.status, stage: video.stage, progress: video.progress });
  }, [video.status, video.stage, video.progress]);

  useEffect(() => {
    if (!working.includes(video.status) || video.stopped) return;
    const source = new EventSource(`/api/events/${video.id}`);
    const on = (type: string, fn: (e: VideoEvent) => void) =>
      source.addEventListener(type, (m) => fn(JSON.parse((m as MessageEvent).data) as VideoEvent));
    on("status", (e) => {
      if (e.type !== "status") return;
      setLive({ status: e.status, stage: e.stage, progress: e.progress });
      // The status moved on from what this page was rendered with (e.g. it finished while we were
      // reconnecting): reload the steps and scenes from the server.
      if (e.status !== video.status) router.refresh();
    });
    // EventSource reconnects by itself after a drop; reload server data each time it reconnects.
    let opened = false;
    source.addEventListener("open", () => {
      if (opened) router.refresh();
      opened = true;
    });
    on("render", (e) => {
      if (e.type === "render") setLive((l) => ({ ...l, progress: Math.round(75 + e.progress * 0.24) }));
    });
    on("step", (e) => {
      if (e.type !== "step") return;
      if (e.state === "started") setLive((l) => ({ ...l, stage: e.stage }));
      if (e.detail) setDetail((d) => ({ ...d, [e.stage]: e.detail }));
      if (e.state !== "started") router.refresh();
    });
    for (const t of ["script", "claims", "done", "error"]) on(t, () => router.refresh());
    return () => source.close();
  }, [video.id, video.status, video.stopped, router]);

  const status = live.status;
  const failed = status === "failed";
  const stopped = video.stopped && status === "draft";
  const busy = working.includes(status) && !stopped;
  const stepState = (stage: "script" | "factcheck", server: StepState): StepState =>
    server === "done" || server === "failed" ? server : live.stage === stage && busy ? "active" : server;
  const scriptState = stepState("script", video.steps.script.state);
  const factState = stepState("factcheck", video.steps.factcheck.state);
  const ready = ["previewed", "rendered"].includes(status);
  const finalizing =
    ["voicing", "rendering"].includes(status) || (failed && ["voice", "render"].includes(video.error?.stage ?? ""));

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setActionError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setActionError(res.error?.message ?? "Something went wrong.");
      router.refresh();
    });
  };

  const s = video.steps;
  // Claims about the creator's own product can't be verified by AI: promos are never labelled "Fact-checked".
  const promo = video.format === "promo";
  const stepNo = finalizing
    ? 4
    : ready
      ? 3
      : factState === "done" || factState === "active" || factState === "failed"
        ? 2
        : 1;
  // How far the teal-to-lime line down the stepper reaches: to the step being worked on.
  const lineFill = finalizing ? "100%" : ready ? "66%" : stepNo === 2 ? "38%" : "0%";
  const length = video.lengthSeconds ?? (video.timeline ? Math.round(video.timeline.durationInFrames / 30) : null);
  const failedStep =
    video.error?.stage === "voice"
      ? "Recording voice"
      : video.error?.stage === "render"
        ? "Rendering video"
        : scriptState === "failed"
          ? "Writing the script"
          : "Checking facts";
  const caption = video.scenes[0]?.narration ?? video.topic;
  const format = `${video.format[0]?.toUpperCase()}${video.format.slice(1)}`;

  const pill = failed
    ? { label: "Failed", className: "border-red/20 bg-red-soft text-red-ink", dot: "bg-red" }
    : stopped
      ? { label: "Stopped", className: "border-line bg-wash text-ink-2", dot: "bg-ink-3" }
      : ready
        ? { label: "Preview ready", className: "border-teal-ink/20 bg-teal-soft text-teal-ink", dot: "bg-teal" }
        : {
            label: "Processing",
            className: "border-teal-ink/20 bg-[#6df5e1]/30 text-teal-ink",
            dot: "bg-[#4fdbc8] pulse-soft",
          };

  const previewNote = failed
    ? "Preview not available · Retry to continue"
    : stopped
      ? "Stopped · No preview for a stopped video"
      : finalizing
        ? status === "voicing"
          ? "Recording voiceover · Your scenes are saved"
          : `Rendering final video · ${live.progress}% complete`
        : ready
          ? "Preview ready · Opening your storyboard"
          : `Preview loading · ${factState === "active" ? "Checking every claim" : "Writing your scenes"}`;

  return (
    <>
      <TopBar title={video.title} />
      <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-10 p-4 sm:p-8">
        {/* Title row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-2">
          <div className="flex flex-wrap items-center gap-3.5">
            <h1 className="text-[26px]/[34px] font-semibold tracking-[-0.02em] sm:text-[32px]/[40px]">
              {finalizing ? "Rendering your video" : "Building your video"}
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]/[14px] font-semibold tracking-[0.02em]",
                pill.className,
              )}
            >
              <span className={cn("size-2 rounded-full", pill.dot)} />
              {pill.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[13px]/[18px] text-ink-2 tabular-nums">
            <span>{format}</span>
            {length && (
              <>
                <span className="text-line">·</span>
                <span>{length}s</span>
              </>
            )}
            <span className="text-line">·</span>
            <span>Voice: {video.voiceName}</span>
          </div>
        </div>

        <div className="grid grid-cols-12 items-start gap-8">
          {/* Pipeline stepper */}
          <section className="col-span-12 flex flex-col justify-between rounded-xl border border-line bg-panel p-6 shadow-[0px_1px_3px_rgba(15,15,15,0.03)] lg:col-span-7">
            <div>
              <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-4">
                <div>
                  <h2 className="text-[18px]/[26px] font-semibold tracking-[-0.01em]">Generation pipeline</h2>
                  <p className="mt-0.5 text-[13px]/[18px] text-ink-2">
                    {finalizing
                      ? "Recording voiceover, synchronizing captions and rendering scenes"
                      : "Automated script drafting, validation, and layout compilation"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-line bg-wash px-2.5 py-1 text-[11px]/[14px] font-semibold tracking-[0.02em] text-ink tabular-nums">
                  Step {stepNo} of 4
                </span>
              </div>

              <div className="relative flex flex-col gap-6 py-6 pl-2">
                <div aria-hidden className="absolute top-9 bottom-9 left-[23px] w-0.5 bg-[#ebe7e7]">
                  <div
                    className="w-full bg-linear-to-b from-teal-ink to-lime transition-all duration-500"
                    style={{ height: lineFill }}
                  />
                </div>
                <StepRow
                  n={1}
                  title="Writing the script"
                  state={scriptState}
                  meta={
                    scriptState === "done"
                      ? `${s.script.scenes} scenes · ${s.script.words} words${secs(s.script.ms)}`
                      : scriptState === "active"
                        ? "Gemini is writing your scenes…"
                        : scriptState === "failed"
                          ? "Couldn't finish this step"
                          : stopped
                            ? "Stopped"
                            : "Starts in a moment"
                  }
                />
                <StepRow
                  n={2}
                  title="Checking facts"
                  state={factState}
                  meta={
                    factState === "done"
                      ? `${s.factcheck.claims} claims checked${promo ? " · confirm product details" : ""}${s.factcheck.toReview ? ` · ${s.factcheck.toReview} to review` : ""}${s.factcheck.rewrites ? ` · ${s.factcheck.rewrites} fixed` : ""}${secs(s.factcheck.ms)}`
                      : factState === "active"
                        ? (detail.factcheck ?? "Verifying every claim and number…")
                        : factState === "failed"
                          ? "Couldn't finish this step"
                          : "After the script"
                  }
                  extra={
                    factState === "active" && s.script.state === "done" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-[11px] font-semibold text-ink">
                          <ShieldCheck className="size-[13px] text-teal-ink" strokeWidth={2.25} />
                          Script · {s.script.scenes} scenes written
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-[11px] font-semibold text-ink">
                          <RotateCcw className="spin-slow size-[13px] text-[#566d00]" strokeWidth={2.25} />
                          {promo ? "Product details · Checking…" : "Claims and numbers · Checking…"}
                        </span>
                      </div>
                    ) : null
                  }
                />
                <StepRow
                  n={3}
                  title="Preview"
                  state={s.script.state === "done" ? "done" : "waiting"}
                  meta={s.script.state === "done" ? "Your storyboard is ready" : "Plays here when ready"}
                />
                <StepRow
                  n={4}
                  title="Voice and render"
                  state={finalizing ? (failed ? "failed" : "active") : "locked"}
                  meta={
                    finalizing
                      ? failed
                        ? "Retry to continue from the saved step"
                        : status === "voicing"
                          ? "Recording narration and synchronizing captions…"
                          : `Rendering animated scenes · ${live.progress}%`
                      : "Starts when you click Render"
                  }
                />
              </div>

              {failed && video.error ? (
                <div role="alert" className="flex flex-col gap-2 rounded-lg border border-red/20 bg-red-soft/40 p-3">
                  <div className="flex items-center gap-2 text-red-ink">
                    <AlertCircle className="size-[18px]" strokeWidth={2} />
                    <span className="text-[13px]/[18px] font-medium">{failedStep} · Failed</span>
                  </div>
                  <p className="text-[13px]/[18px] text-ink">{video.error.message}</p>
                </div>
              ) : stopped ? (
                <div className="rounded-lg border border-line bg-paper p-3 text-[13px]/[18px] text-ink-2">
                  You stopped this video.
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-2.5 border-t border-line/60 pt-5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f0edec]">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-lime to-[#4fdbc8] transition-all duration-300"
                      style={{ width: `${ready ? 100 : live.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[13px]/[18px] font-medium tabular-nums">
                    <span className="text-ink">{ready ? "Done" : `${live.progress}% complete`}</span>
                    <span className="font-normal text-ink-2">{busy ? "Working in the background" : ""}</span>
                  </div>
                </div>
              )}

              {actionError && <p className="mt-3 text-[13px]/[18px] text-red-ink">{actionError}</p>}
            </div>

            {/* Footer: cancel while running; retry / start over once it has stopped */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
              {failed ? (
                <div className="flex flex-1 flex-wrap items-center gap-2.5">
                  {video.canRetry && (
                    <button
                      type="button"
                      onClick={() => run(() => retryVideo({ videoId: video.id }))}
                      disabled={pending}
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-lime px-3 text-[13px]/[18px] font-medium text-ink transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
                    >
                      {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                      Retry
                    </button>
                  )}
                  <Link
                    href="/create"
                    className="flex h-9 items-center rounded-lg border border-line bg-panel px-3.5 text-[13px]/[18px] font-medium text-ink transition-colors hover:bg-wash"
                  >
                    Start a new video
                  </Link>
                </div>
              ) : stopped || ready ? (
                <Link
                  href={ready ? `/videos/${video.id}` : "/create"}
                  className="flex h-9 items-center rounded-lg border border-line bg-panel px-3.5 text-[13px]/[18px] font-medium text-ink transition-colors hover:bg-wash"
                >
                  {ready ? "Open storyboard" : "Start a new video"}
                </Link>
              ) : video.canCancel ? (
                <button
                  type="button"
                  onClick={() => run(() => cancelVideo({ videoId: video.id }))}
                  disabled={pending}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px]/[18px] font-medium text-ink-2 transition-colors hover:bg-red-soft/40 hover:text-red disabled:opacity-60"
                >
                  {pending ? <Loader2 className="size-[17px] animate-spin" /> : <X className="size-[17px]" />}
                  Cancel generation
                </button>
              ) : (
                <span />
              )}
              {busy && (
                <div className="flex max-w-xs items-center gap-1.5 text-right text-[11px]/[14px] font-semibold tracking-[0.02em] text-ink-2/80">
                  <Info className="size-[15px] shrink-0 text-ink-3" strokeWidth={1.75} />
                  <span>You can leave this page. We'll keep working. Come back to see the result.</span>
                </div>
              )}
            </div>
          </section>

          {/* 9:16 preview placeholder */}
          <div className="col-span-12 flex flex-col items-center justify-center lg:col-span-5">
            <div className="relative flex h-[570px] w-full max-w-[320px] flex-col justify-between overflow-hidden rounded-[28px] border border-white/10 bg-ink p-4 shadow-[0px_16px_40px_rgba(15,15,15,0.18)] select-none">
              <div className="relative z-20 flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md tabular-nums">
                  <span className={cn("size-1.5 rounded-full bg-lime", busy && "pulse-soft")} />
                  00:00{length ? ` / ${clock(length)}` : ""}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-3 items-end gap-0.5 rounded bg-white/10 px-1.5 py-0.5">
                    <span className={cn("h-2 w-0.5 bg-white/80", busy && "animate-pulse")} />
                    <span className="h-3 w-0.5 bg-lime" />
                    <span className="h-1.5 w-0.5 bg-white/60" />
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/80 uppercase backdrop-blur-md">
                    9:16 Reels
                  </span>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <div className={cn("absolute size-72 rounded-full border border-white/5", busy && "spin-slow")} />
                <div className="absolute size-56 rounded-full border border-dashed border-white/10" />
                <div className="relative flex flex-col items-center opacity-85">
                  <svg aria-hidden fill="none" width="180" height="110" viewBox="0 0 180 110" className="text-white/20">
                    <path
                      d="M10 75C25 75 45 78 60 70C75 62 85 45 105 35C125 25 150 25 165 42C172 50 170 65 160 75C140 92 110 90 85 90C60 90 35 90 10 75Z"
                      stroke="currentColor"
                      strokeDasharray="3 3"
                      strokeWidth="1.5"
                    />
                    <path d="M40 73L75 55L110 50L145 68" stroke="url(#cw-lime-teal)" strokeWidth="2" />
                    <circle cx="75" cy="55" r="3" fill="#C6F432" />
                    <circle cx="110" cy="50" r="3" fill="#4FDCB8" />
                    <defs>
                      <linearGradient id="cw-lime-teal" x1="40" x2="145" y1="55" y2="68" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#C6F432" />
                        <stop offset="1" stopColor="#14B8A6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className={cn("mt-4 h-2 w-36 rounded-full", busy ? "shimmer" : "bg-white/5")} />
                  <div className={cn("mt-1.5 h-1.5 w-24 rounded-full opacity-60", busy ? "shimmer" : "bg-white/5")} />
                </div>
                <div className="absolute inset-x-4 top-[54%] z-20 flex -translate-y-1/2 justify-center">
                  <div className="flex max-w-[270px] items-center gap-2.5 rounded-xl border border-white/15 bg-black/60 px-3 py-2 shadow-xl backdrop-blur-xl">
                    {busy ? (
                      <span className="spin-slow size-3.5 shrink-0 rounded-full border-2 border-lime border-t-transparent" />
                    ) : failed ? (
                      <AlertCircle className="size-3.5 shrink-0 text-red" />
                    ) : ready ? (
                      <Check className="size-3.5 shrink-0 text-lime" strokeWidth={3} />
                    ) : (
                      <span className="size-2 shrink-0 rounded-full bg-white/40" />
                    )}
                    <span className="text-[11px] leading-tight text-white/90">{previewNote}</span>
                  </div>
                </div>
              </div>

              <div className="relative z-20 flex flex-col gap-3 pb-2">
                <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 text-left backdrop-blur-md">
                  <div className="mb-1 text-[10px] font-semibold tracking-wider text-white/50 uppercase">
                    {video.scenes.length ? "Generated captions" : "Your idea"}
                  </div>
                  <div className="line-clamp-3 text-[12px] leading-snug text-white/90">“{caption}”</div>
                </div>
                <div className="flex items-center gap-2 px-1">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-lime transition-all duration-300"
                      style={{ width: `${ready ? 100 : failed || stopped ? 0 : live.progress}%` }}
                    />
                  </div>
                  <Maximize className="size-4 text-white/60" strokeWidth={1.75} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px]/[14px] font-semibold tracking-[0.02em] text-ink-2">
              <span className="flex items-center gap-1">
                <Ratio className="size-[15px]" strokeWidth={1.75} />
                1080 × 1920 (9:16)
              </span>
              <span>·</span>
              <span>Kinetic Typography</span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

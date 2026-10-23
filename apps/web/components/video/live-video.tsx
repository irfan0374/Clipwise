"use client";

import type { Stage, VideoEvent, VideoStatus } from "@clipwise/shared";
import { cn } from "cn";
import {
  AlertCircle,
  Check,
  Clapperboard,
  Loader2,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cancelVideo, retryVideo } from "@/app/(app)/actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { StepState, VideoView } from "@/lib/videos";

const secs = (ms: number | null) => (ms == null ? "" : ` · ${Math.max(1, Math.round(ms / 1000))}s`);
const working: VideoStatus[] = ["draft", "scripting", "checking", "voicing", "rendering"];

function StepIcon({ state, locked }: { state: StepState; locked?: boolean }) {
  if (locked) return <Lock className="size-4 text-ink-3" />;
  if (state === "done") return <Check className="size-4 text-teal-ink" strokeWidth={2.5} />;
  if (state === "active") return <Loader2 className="size-4 animate-spin text-ink" />;
  if (state === "failed") return <AlertCircle className="size-4 text-red" />;
  return <span className="size-2 rounded-full bg-[#cfcfc6]" />;
}

function Step({
  title,
  meta,
  state,
  locked,
  last,
}: {
  title: string;
  meta: string;
  state: StepState;
  locked?: boolean;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className={cn(
            "absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5 rounded-full",
            state === "done" ? "bg-linear-to-b from-lime to-teal" : "bg-line",
          )}
        />
      )}
      <span
        className={cn(
          "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border",
          state === "done" && "border-teal-soft bg-teal-soft",
          state === "active" && "border-lime bg-lime/40",
          state === "failed" && "border-red-soft bg-red-soft",
          (state === "waiting" || locked) && "border-line bg-paper",
        )}
      >
        <StepIcon state={state} locked={locked} />
      </span>
      <span className="min-w-0 pt-1">
        <span className={cn("block text-body font-medium", locked || state === "waiting" ? "text-ink-3" : "text-ink")}>
          {title}
        </span>
        <span className="block text-small text-ink-2">{meta}</span>
      </span>
    </li>
  );
}

/** The Generating screen: live steps (server-sent events), cancel/retry, and the script as a scene list. */
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
  const ready = video.steps.factcheck.state === "done";

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
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <nav className="text-small text-ink-3">
          <Link href="/videos" className="hover:text-ink">
            Videos
          </Link>{" "}
          / <span className="text-ink-2">{video.title}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h2">{video.title}</h1>
          <StatusBadge status={status} />
        </div>
        <p className="text-small text-ink-3">
          {video.format[0]?.toUpperCase()}
          {video.format.slice(1)}
          {video.lengthSeconds ? ` · ${video.lengthSeconds}s` : ""}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="space-y-6 rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <ol>
            <Step
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
            <Step
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
            />
            <Step
              title="Preview"
              state={ready ? "done" : "waiting"}
              meta={ready ? "Your scenes are ready below" : "Shows here when ready"}
            />
            <Step title="Voice and render" state="waiting" locked meta="Starts when you click Render" last />
          </ol>

          {failed && video.error ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-red-soft p-4">
              <AlertCircle className="size-5 shrink-0 text-red" />
              <p className="min-w-0 flex-1 text-small text-red-ink">{video.error.message}</p>
              {video.canRetry && (
                <Button onClick={() => run(() => retryVideo({ videoId: video.id }))} disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Retry
                </Button>
              )}
            </div>
          ) : stopped ? (
            <div className="rounded-xl bg-paper p-4 text-small text-ink-2">
              You stopped this video.{" "}
              <Link href="/create" className="font-medium text-teal-ink hover:underline">
                Start a new one
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <Progress value={live.progress} aria-label="Progress" />
              <p className="text-label text-ink-3 tabular-nums">{busy ? `${live.progress}%` : ready ? "Done" : ""}</p>
            </div>
          )}

          {actionError && <p className="text-small text-red-ink">{actionError}</p>}

          {busy && (
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              {video.canCancel ? (
                <Button
                  variant="ghost"
                  onClick={() => run(() => cancelVideo({ videoId: video.id }))}
                  disabled={pending}
                >
                  Cancel
                </Button>
              ) : (
                <span />
              )}
              <p className="text-small text-ink-3">You can leave this page. We'll keep working.</p>
            </footer>
          )}
        </section>

        <aside className="mx-auto w-full max-w-[280px]">
          <div className="relative grid aspect-[9/16] place-items-center overflow-hidden rounded-3xl bg-ink">
            {busy && <div className="absolute inset-0 animate-pulse bg-linear-to-b from-white/5 to-transparent" />}
            <div className="relative space-y-2 px-6 text-center">
              {ready ? (
                <>
                  <Sparkles className="mx-auto size-6 text-lime" />
                  <p className="text-small font-medium text-white">Animated preview coming next</p>
                  <p className="text-label text-white/60">For now, read your scenes below.</p>
                </>
              ) : stopped ? (
                <>
                  <Clapperboard className="mx-auto size-6 text-white/40" />
                  <p className="text-small font-medium text-white/80">Stopped</p>
                  <p className="text-label text-white/50">No preview for a stopped video.</p>
                </>
              ) : failed ? (
                <>
                  <AlertCircle className="mx-auto size-6 text-red" />
                  <p className="text-small font-medium text-white/80">Preview not available</p>
                  <p className="text-label text-white/50">Retry to continue.</p>
                </>
              ) : (
                <>
                  <Clapperboard className="mx-auto size-6 text-white/50" />
                  <p className="text-label text-white/60">Preview loading</p>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      {video.scenes.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-h3">Scenes</h2>
            {s.factcheck.state === "done" &&
              (promo ? (
                <Badge variant="amber">
                  <ShieldAlert />
                  {s.factcheck.toReview ? `${s.factcheck.toReview} to review · ` : ""}Check product details
                </Badge>
              ) : (
                <Badge variant={s.factcheck.toReview ? "amber" : "teal"}>
                  <ShieldCheck />
                  {s.factcheck.toReview ? `${s.factcheck.toReview} to review` : "Fact-checked"}
                </Badge>
              ))}
          </div>
          {promo && s.factcheck.state === "done" && (
            <p className="rounded-lg bg-amber-soft px-3 py-2 text-small text-amber-ink">
              Clipwise can't verify claims about your own product. Before you render, make sure every feature and detail
              in these scenes is true.
            </p>
          )}
          <ol className="grid gap-3 sm:grid-cols-2">
            {video.scenes.map((scene) => (
              <li key={scene.index} className="space-y-3 rounded-xl border border-line bg-panel p-4">
                <div className="flex items-center gap-2 text-label text-ink-3">
                  <span className="font-semibold text-ink">Scene {scene.index + 1}</span>
                  <span>·</span>
                  <span>
                    {scene.template === "title" ? "Title" : scene.template === "stat" ? "Big number" : "Points"}
                  </span>
                  {scene.visual && (
                    <>
                      <span>·</span>
                      <span>{scene.visual} animation</span>
                    </>
                  )}
                </div>
                <p className="text-body text-ink">{scene.narration}</p>
                <div className="flex flex-wrap gap-1.5">
                  {scene.stat && <Badge variant="ink">{scene.stat.value}</Badge>}
                  {scene.onScreenText.map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                </div>
                {scene.claims.map((c) => (
                  <div key={c.text} className="rounded-lg bg-amber-soft px-3 py-2 text-small text-amber-ink">
                    <span className="font-medium">{c.verdict === "unsure" ? "Please check: " : "Might be off: "}</span>“
                    {c.text}”{c.fix ? ` → ${c.fix}` : ""}
                  </div>
                ))}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

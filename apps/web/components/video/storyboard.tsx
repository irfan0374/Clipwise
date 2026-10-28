"use client";

import { Player, Thumbnail } from "@remotion/player";
import { cn } from "cn";
import {
  Check,
  CircleCheck,
  CirclePlay,
  GripVertical,
  Info,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Shapes,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { Soon } from "@/components/app/soon";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { sceneDragHandlers } from "./scene-drag";
import { Composition, clock, FPS, moveOrder, quoteOf, REVIEW, roleOf, type Scene, sceneColors } from "./studio-shared";
import type { Studio } from "./use-studio";

const iconButton =
  "grid place-items-center rounded p-1.5 text-ink-2 transition-colors hover:bg-paper hover:text-ink disabled:pointer-events-none disabled:opacity-40";

/** The Storyboard tab: every scene at a glance, a silent preview on click, approval before any voice is recorded. */
export function StoryboardView({
  studio,
  open,
}: {
  studio: Studio;
  open: (scene: number, panel?: "script" | "visual") => void;
}) {
  const { video } = studio;
  const [playing, setPlaying] = useState<Scene | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const timeline = video.timeline!;
  const props = timeline as unknown as Record<string, unknown>;
  const total = timeline.durationInFrames;
  const words = video.steps.script.words;
  // Claims about the creator's own product can't be verified by AI: promos are never labelled "verified".
  const promo = video.format === "promo";
  const toReview = video.scenes.reduce((n, s) => n + s.claims.length, 0);
  const checking = video.scenes.some((s) => s.checking);
  const count = video.scenes.length;
  const busy = studio.save === "saving";

  return (
    <>
      {/* Timing and fact-check strip */}
      <section className="z-20 flex flex-col gap-3 border-b border-line bg-panel px-4 py-3 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="max-w-4xl flex-1">
          <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-line">
            {video.scenes.map((s, i) => (
              <button
                key={s.index}
                type="button"
                onClick={() => setPlaying(s)}
                title={`Scene ${i + 1}: ${((s.endFrame - s.startFrame) / FPS).toFixed(1)}s${s.claims.length ? " (needs review)" : ""}`}
                aria-label={`Play scene ${i + 1}`}
                className="h-full transition-opacity hover:opacity-90"
                style={{
                  width: `${((s.endFrame - s.startFrame) / total) * 100}%`,
                  background: s.claims.length ? REVIEW : sceneColors[i % sceneColors.length],
                }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-3 tabular-nums">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {video.scenes.map((s, i) => {
                const review = s.claims.length > 0;
                return (
                  <span
                    key={s.index}
                    className={cn(
                      "flex items-center gap-1",
                      i === 0 && "font-semibold text-ink",
                      review && "font-medium text-amber-ink",
                    )}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: review ? REVIEW : sceneColors[i % sceneColors.length] }}
                    />
                    S{i + 1}{" "}
                    <span className={cn("font-normal", review ? "text-amber-ink" : "text-ink-3")}>
                      {Math.round((s.endFrame - s.startFrame) / FPS)}s
                    </span>
                  </span>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-ink-2">
              <span>{clock(total)}</span>
              <span>·</span>
              <span>{count} scenes</span>
              <span>·</span>
              <span>{words} words</span>
              <span>·</span>
              <span className="rounded border border-line bg-paper px-1.5 py-0.5 text-[10px]">1080×1920 30fps</span>
            </div>
          </div>
        </div>
        {promo ? (
          <div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-[#FDE68A] bg-amber-soft px-3.5 py-1.5 text-xs font-medium text-amber-ink shadow-xs lg:self-auto">
            <ShieldAlert className="size-4" strokeWidth={2} />
            <span>
              <strong className="font-semibold">{video.claims.length} claims</strong> · check product details
              {checking ? " · checking edits…" : ""}
            </span>
          </div>
        ) : (
          <div
            className={cn(
              "flex shrink-0 items-center gap-2 self-start rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-xs lg:self-auto",
              toReview
                ? "border-[#FDE68A] bg-amber-soft text-amber-ink"
                : "border-[#99F6E4] bg-teal-soft text-teal-ink",
            )}
          >
            {checking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" strokeWidth={2} />
            )}
            <span>
              Fact-check: <strong className="font-semibold">{video.claims.length} claims checked</strong>
              {toReview ? ` · ${toReview} to review` : ""}
              {checking ? " · checking edits…" : ""}
            </span>
          </div>
        )}
      </section>

      {/* Storyboard canvas */}
      <main className="mx-auto w-full max-w-[1340px] flex-1 px-4 py-6 pb-28 sm:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">Storyboard overview</span>
            <p className="mt-0.5 text-xs text-ink-2">
              Drag scenes to reorder · Click any frame to play the silent preview
            </p>
          </div>
          <Soon label="Arrives with the voice">
            <span className="flex items-center gap-2 opacity-60">
              <span className="text-xs text-ink-3">Auto-sync audio</span>
              <span className="flex h-4 w-8 items-center justify-end rounded-full bg-ink p-0.5">
                <span className="size-3 rounded-full bg-white" />
              </span>
            </span>
          </Soon>
        </div>
        {promo && (
          <p className="mb-5 rounded-lg border border-[#FDE68A] bg-amber-soft px-3 py-2 text-xs text-amber-ink">
            Clipwise can't verify claims about your own product. Before you render, make sure every feature and detail
            in these scenes is true.
          </p>
        )}

        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {video.scenes.map((scene, i) => {
            const mid = Math.floor((scene.startFrame + scene.endFrame) / 2);
            const claims = scene.claims;
            const review = claims.length > 0;
            const rewriting = studio.busyScene === scene.index;
            return (
              <li
                key={`${scene.index}-${video.scriptVersion}`}
                data-reorder-scene={i}
                className={cn(
                  "group relative flex flex-col justify-between overflow-hidden rounded-xl bg-panel transition-all",
                  review ? "border-2 border-amber shadow-sm" : "border border-line shadow-xs hover:border-ink",
                  dragging === i && "opacity-40",
                  over === i && dragging !== i && "ring-2 ring-teal ring-offset-2 ring-offset-paper",
                )}
              >
                {/* Frame (4:5 crop of the 9:16 scene) */}
                <button
                  type="button"
                  onClick={() => setPlaying(scene)}
                  aria-label={`Play scene ${i + 1}`}
                  className="relative flex aspect-[4/5] w-full flex-col justify-between overflow-hidden bg-ink p-4 text-left outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <div className="absolute inset-x-0 top-1/2 aspect-[9/16] -translate-y-1/2 opacity-55 transition-opacity group-hover:opacity-75">
                    <Thumbnail
                      component={Composition}
                      inputProps={props}
                      compositionWidth={1080}
                      compositionHeight={1920}
                      frameToDisplay={mid}
                      durationInFrames={total}
                      fps={FPS}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                  <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/30 to-black/40" />
                  <div className="relative z-10 flex items-center justify-between">
                    {review ? (
                      <span className="flex items-center gap-1 rounded-full border border-[#FDE68A] bg-amber-soft px-2 py-0.5 text-[10px] font-bold text-amber-ink">
                        <TriangleAlert className="size-[13px]" strokeWidth={2} />
                        Review
                      </span>
                    ) : i === 0 ? (
                      <span className="rounded-full border border-white/20 bg-ink px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                        Hook
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-medium tracking-wider text-white uppercase backdrop-blur-md">
                        {roleOf(scene, i, count)}
                      </span>
                    )}
                    <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white/90 backdrop-blur-sm tabular-nums">
                      {((scene.endFrame - scene.startFrame) / FPS).toFixed(1)}s
                    </span>
                  </div>
                  <p className="relative z-10 line-clamp-3 font-heading text-base leading-tight font-semibold tracking-tight text-white">
                    “{quoteOf(scene)}”
                  </p>
                  {rewriting && (
                    <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 backdrop-blur-sm">
                      <span className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">
                        <Loader2 className="size-3.5 animate-spin text-lime" /> Rewriting with AI…
                      </span>
                    </div>
                  )}
                </button>

                {/* Card body */}
                <div className={cn("flex flex-1 flex-col justify-between p-4", review && "bg-amber-50/20")}>
                  <div>
                    <div
                      className={cn(
                        "mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold tracking-wider uppercase tabular-nums",
                        review ? "text-amber-ink" : "text-ink-3",
                      )}
                    >
                      <span>
                        Scene {i + 1} · {clock(scene.startFrame)}–{clock(scene.endFrame)}
                      </span>
                      {scene.checking ? (
                        <span className="flex items-center gap-0.5 text-ink-3">
                          <Loader2 className="size-[13px] animate-spin" /> checking
                        </span>
                      ) : review ? (
                        <span className="flex items-center gap-0.5">
                          <TriangleAlert className="size-[13px]" strokeWidth={2} /> unverified
                        </span>
                      ) : (
                        !promo && (
                          <span className="flex items-center gap-0.5 text-teal-ink">
                            <CircleCheck className="size-[13px]" strokeWidth={2} /> verified
                          </span>
                        )
                      )}
                    </div>
                    <p className="text-sm leading-snug text-ink">{scene.narration}</p>
                    {claims.map((c) => (
                      <div
                        key={c.index}
                        className="mt-2.5 flex items-start gap-1.5 rounded-md border border-[#FDE68A] bg-amber-soft p-2 text-[11px] leading-normal text-amber-ink"
                      >
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                        <span>
                          <strong>
                            {promo ? "Check this detail:" : c.verdict === "unsure" ? "Please check:" : "Might be off:"}
                          </strong>{" "}
                          “{c.text}”{c.fix ? ` → ${c.fix}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Action strip */}
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-ink-2">
                    <div className="flex items-center gap-1">
                      {review ? (
                        <>
                          {claims.map((c) => (
                            <button
                              key={c.index}
                              type="button"
                              onClick={() => void studio.acceptClaim(c.index)}
                              className="flex items-center gap-1 rounded border border-[#FDE68A] bg-amber-soft px-2 py-1 text-[11px] font-medium text-amber-ink transition-colors hover:bg-amber-200"
                            >
                              <Check className="size-3" strokeWidth={2.5} /> Mark as OK
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => open(scene.index)}
                            className="rounded border border-[#FDE68A] bg-panel px-2 py-1 text-[11px] font-medium text-amber-ink transition-colors hover:bg-amber-soft"
                          >
                            Fix claim
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => open(scene.index)}
                            className={iconButton}
                            aria-label="Edit scene"
                            title="Edit scene"
                          >
                            <Pencil className="size-4" strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void studio.rewrite(scene.index)}
                            disabled={busy}
                            className={iconButton}
                            aria-label="Rewrite scene with AI"
                            title="Rewrite with AI"
                          >
                            <RefreshCw className="size-4" strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            onClick={() => open(scene.index, "visual")}
                            className={iconButton}
                            aria-label="Change animation"
                            title="Change animation"
                          >
                            <Shapes className="size-4" strokeWidth={1.75} />
                          </button>
                        </>
                      )}
                    </div>
                    {i === 0 ? (
                      <span className="p-1.5 text-ink-3/40" title="The hook stays first">
                        <GripVertical className="size-4" strokeWidth={1.75} />
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Drag scene ${i + 1} to reorder`}
                        disabled={studio.save === "saving"}
                        onKeyDown={(e) => {
                          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                          e.preventDefault();
                          const next = i + (e.key === "ArrowUp" ? -1 : 1);
                          if (next > 0 && next < video.scenes.length)
                            void studio.reorder(moveOrder(video.scenes.length, i, next));
                        }}
                        {...sceneDragHandlers(
                          i,
                          (from, to) => void studio.reorder(moveOrder(video.scenes.length, from, to)),
                          setDragging,
                          setOver,
                        )}
                        className="touch-none cursor-grab p-1.5 text-ink-3 hover:text-ink active:cursor-grabbing"
                        title="Drag to reorder, or focus and use the up/down arrow keys"
                      >
                        <GripVertical className="size-4" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}

          {/* Add scene */}
          {count < 10 && (
            <li className="group flex min-h-[380px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-line p-6 text-center transition-all hover:border-ink hover:bg-white/70">
              <button
                type="button"
                onClick={() => void studio.add(count - 1, "blank").then((ok) => ok && open(count))}
                disabled={busy}
                className="mb-3 grid size-11 place-items-center rounded-full border border-line bg-panel text-ink shadow-xs transition-all group-hover:scale-110 group-hover:bg-ink group-hover:text-white"
                aria-label="Add a blank scene"
              >
                <Plus className="size-5" strokeWidth={1.75} />
              </button>
              <h2 className="text-sm font-semibold">Add Scene</h2>
              <p className="mt-1 max-w-[180px] text-xs leading-relaxed text-ink-3">
                Add a blank scene to write, or let AI write the next one
              </p>
              <button
                type="button"
                onClick={() => void studio.add(count - 1, "ai")}
                disabled={busy}
                className="mt-4 flex items-center gap-1 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink shadow-2xs transition-colors hover:bg-paper disabled:opacity-60"
              >
                {studio.busyScene === count ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" strokeWidth={1.75} />
                )}
                Write with AI
              </button>
            </li>
          )}
        </ol>
      </main>

      {/* Sticky bottom bar */}
      <footer className="fixed right-0 bottom-0 left-0 z-40 flex h-16 items-center justify-between gap-3 border-t border-line bg-panel/95 px-4 backdrop-blur-md select-none sm:px-8 lg:left-16">
        <div className="hidden items-center gap-2 text-[13px] text-ink-2 md:flex">
          <Info className="size-[18px] text-ink-3" strokeWidth={1.75} />
          <span>Happy with the plan? Rendering records the voice and builds the final video.</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => open(0)}
            className="hidden items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium whitespace-nowrap text-ink transition-colors hover:bg-paper sm:flex"
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.75} />
            Open in editor
          </button>
          <div>
            <button
              type="button"
              disabled={studio.rendering || studio.conflict}
              onClick={() => void studio.startRender()}
              className="flex items-center gap-2 rounded-lg bg-lime px-5 py-2.5 text-xs font-semibold whitespace-nowrap text-ink shadow-[0_0_24px_rgba(198,244,50,0.4)]"
            >
              <CirclePlay className="size-[18px]" strokeWidth={1.75} />
              {studio.rendering ? "Starting…" : "Looks good, render video"}
            </button>
          </div>
        </div>
      </footer>

      {/* Silent preview, opened from a frame or the timing bar */}
      <Dialog open={playing != null} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent className="w-[min(360px,calc(100vw-2rem))] gap-3 bg-ink p-3 ring-white/10 sm:max-w-[360px] [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/10">
          <DialogTitle className="px-1 pr-8 text-sm text-white">
            {playing ? `Scene ${playing.index + 1} · ${clock(playing.startFrame)}` : "Preview"}
          </DialogTitle>
          <DialogDescription className="sr-only">Silent preview of your video</DialogDescription>
          {playing && (
            <div className="overflow-hidden rounded-2xl">
              <Player
                component={Composition}
                inputProps={props}
                durationInFrames={total}
                fps={FPS}
                compositionWidth={1080}
                compositionHeight={1920}
                initialFrame={playing.startFrame}
                autoPlay
                controls
                clickToPlay
                acknowledgeRemotionLicense
                style={{ width: "100%", aspectRatio: "9 / 16", maxHeight: "75vh" }}
              />
            </div>
          )}
          <p className="text-center text-[11px] text-white/50">Silent preview · timing is estimated until the voice</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

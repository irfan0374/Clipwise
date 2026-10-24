"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { cn } from "cn";
import {
  Check,
  Download,
  GripVertical,
  Loader2,
  Maximize,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  VolumeX,
  Wand2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Soon } from "@/components/app/soon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Focus } from "./studio";
import {
  Composition,
  canUseBars,
  clock,
  FPS,
  moveOrder,
  type Scene,
  sceneIcon,
  seconds,
  swatches,
  visualName,
  visualTiles,
} from "./studio-shared";
import type { Studio } from "./use-studio";

const MAX_NARRATION = 400;
const card = "rounded-xl border border-line bg-panel shadow-[0px_1px_3px_rgba(15,15,15,0.03)]";

/** Left column: the scenes, in order. Click to select, drag to reorder, add or delete. */
function SceneList({ studio, selected, select }: { studio: Studio; selected: number; select: (i: number) => void }) {
  const { scenes } = studio.video;
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const busy = studio.save === "saving";
  const add = async (mode: "blank" | "ai") => {
    if (await studio.add(selected, mode)) select(selected + 1);
  };
  return (
    <section className={cn(card, "flex flex-col overflow-hidden")}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-semibold">Scenes</h2>
          <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-2">
            {scenes.length} scenes
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy || scenes.length >= 10}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
          >
            <Plus className="size-3.5" strokeWidth={2} /> Add scene
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => void add("blank")}>
              <Plus /> Blank scene after {selected + 1}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void add("ai")}>
              <Sparkles /> Write with AI after {selected + 1}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ol className="flex flex-col gap-2 max-h-[22rem] overflow-y-auto p-3 lg:max-h-none xl:max-h-[calc(100vh-15rem)]">
        {scenes.map((s, i) => {
          const Icon = sceneIcon(s);
          const active = i === selected;
          const review = s.claims.length > 0;
          return (
            <li
              key={s.index}
              onDragOver={(e) => {
                if (dragging === null || i === 0) return;
                e.preventDefault();
                setOver(i);
              }}
              onDragLeave={() => setOver((o) => (o === i ? null : o))}
              onDrop={() => {
                if (dragging !== null && dragging !== i && i > 0)
                  void studio.reorder(moveOrder(scenes.length, dragging, i));
                setDragging(null);
                setOver(null);
              }}
              className={cn(
                "group relative rounded-lg transition-all",
                active
                  ? "border-2 border-ink bg-panel"
                  : review
                    ? "border border-[#FDE68A] bg-amber-50/40"
                    : "border border-transparent hover:border-line hover:bg-paper",
                dragging === i && "opacity-40",
                over === i && dragging !== i && "ring-2 ring-teal",
              )}
            >
              <button type="button" onClick={() => select(i)} className="block w-full p-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-[12px] font-semibold text-ink tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Icon className="size-4 shrink-0 text-ink" strokeWidth={1.75} />
                    <span className="truncate text-[14px] font-medium text-ink">
                      {s.onScreenText[0] || `Scene ${i + 1}`}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      active ? "bg-lime" : review ? "bg-amber" : s.checking ? "bg-ink-3" : "bg-teal",
                    )}
                  />
                </div>
                <p className="mt-1 truncate text-[12px] text-ink-2">{s.narration}</p>
                <div className="mt-2 flex items-center justify-between text-[12px] tabular-nums">
                  <span className={active ? "font-medium text-ink" : "text-ink-3"}>
                    {clock(s.startFrame)}–{clock(s.endFrame)}
                  </span>
                  {s.checking ? (
                    <span className="flex items-center gap-1 text-ink-3">
                      <Loader2 className="size-3 animate-spin" /> Checking…
                    </span>
                  ) : review ? (
                    <span className="text-amber-ink">Review flag</span>
                  ) : (
                    <span className={active ? "font-medium text-teal-ink" : "text-ink-3"}>{seconds(s)}s</span>
                  )}
                </div>
              </button>
              {i > 0 && (
                <div className="absolute top-2 right-6 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    aria-label={`Drag scene ${i + 1} to reorder`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(i);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className="cursor-grab rounded p-1 text-ink-3 hover:bg-paper hover:text-ink"
                    title="Drag to reorder"
                  >
                    <GripVertical className="size-3.5" />
                  </button>
                  {scenes.length > 3 && (
                    <button
                      type="button"
                      onClick={() => void studio.remove(i)}
                      disabled={busy}
                      className="rounded p-1 text-ink-3 hover:bg-red-soft hover:text-red"
                      aria-label={`Delete scene ${i + 1}`}
                      title="Delete scene"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Centre: the 9:16 silent preview with Stitch's phone chrome and its own controls. */
function Stage({ studio, selected, select }: { studio: Studio; selected: number; select: (i: number) => void }) {
  const { video } = studio;
  const timeline = video.timeline!;
  const total = timeline.durationInFrames;
  const player = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const scene = video.scenes[selected];

  // Selecting a scene shows its start.
  useEffect(() => {
    if (!scene) return;
    player.current?.pause();
    player.current?.seekTo(scene.startFrame);
    setFrame(scene.startFrame);
  }, [scene?.startFrame, scene]);

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onFrame = ({ detail }: { detail: { frame: number } }) => setFrame(detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("seeked", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("ended", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("seeked", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("ended", onPause);
    };
  }, []);

  const current = video.scenes.findIndex((s) => frame >= s.startFrame && frame < s.endFrame);
  const seek = (f: number) => {
    const to = Math.max(0, Math.min(total - 1, Math.round(f)));
    player.current?.seekTo(to);
    setFrame(to);
  };
  const time = `${String(Math.floor(frame / FPS / 60)).padStart(2, "0")}:${((frame / FPS) % 60).toFixed(2).padStart(5, "0")}`;

  return (
    <section className="flex flex-col items-center gap-4">
      <div className="w-full max-w-[380px] rounded-[28px] border border-white/10 bg-ink p-4 shadow-[0px_16px_40px_rgba(15,15,15,0.18)]">
        <div className="mb-3 flex items-center justify-between text-[11px] text-white/80">
          <span className="rounded-md bg-white/10 px-2 py-1 font-mono tracking-wider">REEL · 9:16</span>
          <span className="font-mono text-[13px] font-semibold text-white tabular-nums">{time}</span>
          <span className="rounded-md bg-white/10 px-1.5 py-1 text-[10px] font-semibold">HD 30</span>
        </div>
        <div className="overflow-hidden rounded-2xl">
          <Player
            ref={player}
            component={Composition}
            inputProps={timeline as unknown as Record<string, unknown>}
            durationInFrames={total}
            fps={FPS}
            compositionWidth={1080}
            compositionHeight={1920}
            clickToPlay
            acknowledgeRemotionLicense
            style={{ width: "100%", aspectRatio: "9 / 16" }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-white/80">
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-lime" /> Voice: {video.voiceName}
          </span>
          <span className="font-mono tracking-wider">
            SCENE {Math.max(1, current + 1)} / {video.scenes.length}
          </span>
        </div>
      </div>

      <div className={cn(card, "w-full max-w-[500px] px-5 py-4")}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (playing ? player.current?.pause() : player.current?.play())}
            className="grid size-9 place-items-center rounded-full bg-ink text-white transition-transform active:scale-95"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="size-4" fill="currentColor" />
            ) : (
              <Play className="size-4 translate-x-px" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onClick={() => seek(frame - 5 * FPS)}
            className="text-ink-2 hover:text-ink"
            aria-label="Back 5 seconds"
          >
            <RotateCcw className="size-[18px]" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => seek(frame + 5 * FPS)}
            className="text-ink-2 hover:text-ink"
            aria-label="Forward 5 seconds"
          >
            <RotateCw className="size-[18px]" strokeWidth={1.75} />
          </button>
          <span className="text-[13px] font-medium text-ink tabular-nums">
            {clock(frame)} / {clock(total)}
          </span>
          <span className="ml-auto flex items-center gap-3 text-ink-2">
            <Soon label="Sound arrives with the voice">
              <VolumeX className="size-[18px]" strokeWidth={1.75} />
            </Soon>
            <button
              type="button"
              onClick={() => player.current?.requestFullscreen()}
              aria-label="Full screen"
              className="hover:text-ink"
            >
              <Maximize className="size-[18px]" strokeWidth={1.75} />
            </button>
          </span>
        </div>
        {/* Scrubber with a tick per scene; click a scene's segment to jump there */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Position"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={frame}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") seek(frame - FPS);
            if (e.key === "ArrowRight") seek(frame + FPS);
          }}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - r.left) / r.width) * total);
          }}
          className="relative mt-4 h-2 w-full cursor-pointer rounded-full bg-[#ebe7e7]"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-ink"
            style={{ width: `${(frame / total) * 100}%` }}
          />
          {video.scenes.slice(1).map((s) => (
            <span
              key={s.index}
              className="absolute top-0 h-2 w-0.5 bg-panel"
              style={{ left: `${(s.startFrame / total) * 100}%` }}
            />
          ))}
          <span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-lime"
            style={{ left: `${(frame / total) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[12px] text-ink-3">Silent preview · timing estimated until the voice</p>
          {current >= 0 && current !== selected && (
            <button
              type="button"
              onClick={() => select(current)}
              className="text-[12px] font-medium text-teal-ink hover:underline"
            >
              Edit scene {current + 1}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function VisualPicker({ studio, scene }: { studio: Studio; scene: Scene }) {
  const isStat = scene.template === "stat";
  const busy = studio.save === "saving";
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="font-sans text-[13px] font-semibold">Visual Template</h3>
          <span className="text-[12px] text-ink-3">Animated 3×3</span>
        </div>
        {isStat ? (
          <p className="rounded-lg border border-line bg-paper px-3 py-2 text-[12px] text-ink-2">
            Big-number scenes show the number instead of an animation. Switch the layout to Title or Points to pick one.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {visualTiles.map(({ type, label, icon: Icon }) => {
              const active = scene.visual?.type === type;
              const blocked = type === "bars" && !canUseBars(scene);
              return (
                <button
                  key={type}
                  type="button"
                  disabled={busy || blocked || active}
                  title={blocked ? "A bar chart needs numbers. Use Rewrite with AI to add them." : label}
                  onClick={() => void studio.setVisual(scene.index, { visualType: type })}
                  className={cn(
                    "relative flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-lg text-[12px] transition-all",
                    active
                      ? "border-2 border-ink font-semibold text-ink"
                      : "border border-line text-ink-2 hover:border-ink hover:text-ink",
                    blocked && "cursor-not-allowed opacity-40 hover:border-line",
                  )}
                >
                  {active && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-lime" />}
                  <Icon className="size-4" strokeWidth={1.75} />
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {!isStat && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-ink-2">Colour</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {Object.entries(swatches).map(([name, hex]) => (
              <button
                key={name}
                type="button"
                disabled={busy}
                title={name}
                aria-label={`Colour ${name}`}
                onClick={() => void studio.setVisual(scene.index, { color: name as never })}
                className={cn(
                  "size-5 rounded-full border border-line transition-transform hover:scale-110",
                  scene.visual?.color === name && "ring-2 ring-ink ring-offset-2",
                )}
                style={{ background: hex }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Right column: the selected scene's script and animation. Typing autosaves. */
function Inspector({
  studio,
  scene,
  panel,
  setPanel,
}: {
  studio: Studio;
  scene: Scene;
  panel: "script" | "visual";
  setPanel: (p: "script" | "visual") => void;
}) {
  const i = scene.index;
  const [asking, setAsking] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [statDraft, setStatDraft] = useState({ value: "", label: "" });
  const [statMode, setStatMode] = useState(false);
  const rewriting = studio.busyScene === i;
  const busy = studio.save === "saving";
  const lines = [0, 1, 2].map((k) => scene.onScreenText[k] ?? "");

  const rewrite = async () => {
    await studio.rewrite(i, instruction || undefined);
    setAsking(false);
    setInstruction("");
  };

  return (
    <section className={cn(card, "p-5")}>
      <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="text-[18px] font-semibold">Scene {i + 1} Inspector</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">Timing: {seconds(scene)} seconds</p>
        </div>
        <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-[12px] font-medium text-ink">
          {visualName(scene)}
        </span>
      </div>

      <div className="mt-4 flex rounded-lg border border-line bg-paper p-1">
        {(["script", "visual"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPanel(p)}
            className={cn(
              "flex-1 rounded-md py-1.5 text-[13px] font-medium transition-colors",
              panel === p ? "bg-panel text-ink shadow-xs" : "text-ink-2 hover:text-ink",
            )}
          >
            {p === "script" ? "Script" : "Visual"}
          </button>
        ))}
      </div>

      {panel === "script" ? (
        <div className="mt-5 space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="narration" className="text-[13px] font-semibold">
                Narration Script
              </label>
              <span className="text-[12px] text-ink-3 tabular-nums">
                {scene.narration.length} / {MAX_NARRATION} chars
              </span>
            </div>
            <div className="rounded-lg border border-line bg-paper focus-within:border-ink">
              <textarea
                id="narration"
                value={scene.narration}
                maxLength={MAX_NARRATION}
                disabled={rewriting}
                onChange={(e) => studio.type(i, { narration: e.target.value })}
                rows={4}
                className="block w-full resize-none bg-transparent px-3 pt-3 text-[14px]/[22px] text-ink outline-none"
              />
              <div className="flex items-center justify-between gap-2 px-3 pb-2">
                {!scene.narration.trim() ? (
                  <span className="text-[11px] text-red-ink">The narration can't be empty.</span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setAsking((a) => !a)}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-md bg-panel px-2 py-1 text-[12px] font-medium text-teal-ink transition-colors hover:bg-teal-soft disabled:opacity-50"
                >
                  {rewriting ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                  {rewriting ? "Rewriting…" : "Rewrite with AI"}
                </button>
              </div>
            </div>
            {asking && !rewriting && (
              <div className="mt-2 flex gap-2">
                <input
                  value={instruction}
                  maxLength={200}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void rewrite()}
                  placeholder="What should change? (optional) e.g. shorter, funnier"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-[13px] outline-none focus:border-ink"
                />
                <button
                  type="button"
                  onClick={() => void rewrite()}
                  className="rounded-lg bg-ink px-3 text-[12px] font-medium text-white"
                >
                  Rewrite
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold">On-Screen Text Lines</p>
            <div className="space-y-2">
              {lines.map((line, k) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: always the same three slots, L1–L3
                <div key={k} className="flex items-center gap-3">
                  <span className="w-5 text-[12px] text-ink-3">L{k + 1}</span>
                  <input
                    value={line}
                    maxLength={60}
                    disabled={rewriting || (k > 0 && !lines[k - 1] && !line)}
                    placeholder={k === 0 ? "Main line" : "Optional"}
                    onChange={(e) =>
                      studio.type(i, { onScreenText: lines.map((l, j) => (j === k ? e.target.value : l)) })
                    }
                    className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-[14px] outline-none focus:border-ink disabled:bg-paper"
                  />
                </div>
              ))}
              {!lines.some((l) => l.trim()) && (
                <p className="text-[11px] text-red-ink">Add at least one on-screen line.</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold">Layout</p>
            <div className="flex rounded-lg border border-line bg-paper p-1">
              {(
                [
                  ["title", "Title"],
                  ["bullets", "Points"],
                  ["stat", "Big number"],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  disabled={busy || scene.template === "imageFocus"}
                  onClick={() => {
                    if (t === scene.template) return;
                    if (t === "stat") setStatMode(true);
                    else void studio.setLayout(i, t);
                  }}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-[12px] font-medium transition-colors",
                    scene.template === t || (t === "stat" && statMode)
                      ? "bg-panel text-ink shadow-xs"
                      : "text-ink-2 hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {scene.template === "stat" && scene.stat ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={scene.stat.value}
                  maxLength={6}
                  aria-label="Number"
                  onChange={(e) => studio.type(i, { stat: { value: e.target.value, label: scene.stat?.label ?? "" } })}
                  className="w-24 rounded-lg border border-line px-3 py-2 text-[14px] font-semibold outline-none focus:border-ink"
                />
                <input
                  value={scene.stat.label}
                  maxLength={40}
                  aria-label="Label"
                  onChange={(e) => studio.type(i, { stat: { value: scene.stat?.value ?? "", label: e.target.value } })}
                  className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-[14px] outline-none focus:border-ink"
                />
              </div>
            ) : statMode ? (
              <div className="mt-2 space-y-2 rounded-lg border border-line bg-paper p-3">
                <div className="flex gap-2">
                  <input
                    value={statDraft.value}
                    maxLength={6}
                    placeholder="92%"
                    aria-label="Number"
                    onChange={(e) => setStatDraft((d) => ({ ...d, value: e.target.value }))}
                    className="w-24 rounded-lg border border-line bg-panel px-3 py-2 text-[14px] font-semibold outline-none focus:border-ink"
                  />
                  <input
                    value={statDraft.label}
                    maxLength={40}
                    placeholder="What the number means"
                    aria-label="Label"
                    onChange={(e) => setStatDraft((d) => ({ ...d, label: e.target.value }))}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-[14px] outline-none focus:border-ink"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-ink-3">Use a real number; it will be fact-checked.</span>
                  <button
                    type="button"
                    disabled={!/\d/.test(statDraft.value)}
                    onClick={() => {
                      void studio.setLayout(i, "stat", statDraft);
                      setStatMode(false);
                    }}
                    className="rounded-md bg-ink px-3 py-1 text-[12px] font-medium text-white disabled:opacity-40"
                  >
                    Show number
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-line pt-5">
            <VisualPicker studio={studio} scene={scene} />
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <VisualPicker studio={studio} scene={scene} />
        </div>
      )}
    </section>
  );
}

/** Bottom strip: every claim the fact-check found, with Edit and OK on the ones to review. */
function FactStrip({ studio, select }: { studio: Studio; select: (i: number) => void }) {
  const { video } = studio;
  const promo = video.format === "promo";
  const checking = video.scenes.filter((s) => s.checking);
  const checkingSet = new Set(checking.map((s) => s.index));
  const claims = video.claims.filter((c) => !checkingSet.has(c.scene));
  const toReview = claims.filter((c) => c.verdict !== "correct" && !c.accepted).length;
  return (
    <section className="border-t border-line bg-panel px-4 py-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-teal-soft text-teal-ink">
            <ShieldCheck className="size-4" strokeWidth={2} />
          </span>
          <h2 className="text-[16px] font-semibold">Fact-check</h2>
          <span className="text-[13px] text-ink-2">
            · {claims.length} claims checked{promo ? " · check product details" : ""}
            {toReview ? ` · ${toReview} to review` : ""}
            {checking.length ? ` · checking ${checking.length} edited scene${checking.length > 1 ? "s" : ""}` : ""}
          </span>
        </div>
        <Soon>
          <span className="flex items-center gap-1 text-[13px] text-ink-2">
            <Download className="size-4" strokeWidth={1.75} /> Export Log
          </span>
        </Soon>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {checking.map((s) => (
          <div
            key={`checking-${s.index}`}
            className="flex w-[330px] shrink-0 items-center gap-3 rounded-lg border border-line bg-paper p-3"
          >
            <Loader2 className="size-4 animate-spin text-ink-3" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">
                <span className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
                  Scene {String(s.index + 1).padStart(2, "0")}
                </span>{" "}
                Checking facts…
              </p>
              <p className="text-[12px] text-ink-3">Your edit is being checked</p>
            </div>
          </div>
        ))}
        {claims.map((c) => {
          const review = c.verdict !== "correct" && !c.accepted;
          return (
            <div
              key={c.index}
              className={cn(
                "flex w-[380px] shrink-0 items-center gap-3 rounded-lg border p-3",
                review ? "border-[#FDE68A] bg-amber-50/50" : "border-line bg-paper",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">
                  <span
                    className={cn(
                      "text-[11px] font-semibold tracking-wider uppercase",
                      review ? "text-amber-ink" : "text-ink-3",
                    )}
                  >
                    Scene {String(c.scene + 1).padStart(2, "0")}
                  </span>{" "}
                  “{c.text}”
                </p>
                <p className={cn("truncate text-[12px]", review ? "text-amber-ink" : "text-ink-3")}>
                  {review
                    ? c.fix
                      ? `Suggested: ${c.fix}`
                      : c.verdict === "unsure"
                        ? "Couldn't be confirmed. Check it or change it."
                        : "Might be wrong. Check it or change it."
                    : c.accepted
                      ? "You marked this as OK"
                      : promo
                        ? "Matches your brief"
                        : "Verified"}
                </p>
              </div>
              {review ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-medium text-amber-ink">
                    Review
                  </span>
                  <button
                    type="button"
                    onClick={() => select(c.scene)}
                    className="rounded-md border border-line bg-panel px-2.5 py-1 text-[12px] font-medium text-ink hover:bg-paper"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void studio.acceptClaim(c.index)}
                    className="rounded-md bg-ink px-2.5 py-1 text-[12px] font-medium text-white"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    c.accepted ? "bg-wash text-ink-2" : "bg-teal-soft text-teal-ink",
                  )}
                >
                  {c.accepted ? (
                    <span className="flex items-center gap-1">
                      <Check className="size-3" /> OK
                    </span>
                  ) : (
                    "Correct"
                  )}
                </span>
              )}
            </div>
          );
        })}
        {!claims.length && !checking.length && (
          <p className="flex items-center gap-1.5 text-[13px] text-ink-3">
            <TriangleAlert className="size-4" /> No claims to check in this script.
          </p>
        )}
      </div>
    </section>
  );
}

/** The Edit tab (Stitch "Studio Video Editor"): scenes, preview and inspector, with the fact-check below. */
export function Editor({ studio, focus, go }: { studio: Studio; focus: Focus; go: (f: Partial<Focus>) => void }) {
  const selected = Math.min(focus.scene, studio.video.scenes.length - 1);
  const scene = studio.video.scenes[selected];
  const select = (i: number) => go({ scene: i });
  if (!scene) return null;
  return (
    <>
      <main className="grid flex-1 grid-cols-1 items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_400px]">
        <SceneList studio={studio} selected={selected} select={select} />
        <Stage studio={studio} selected={selected} select={select} />
        <div className="lg:col-span-2 xl:col-span-1">
          <Inspector
            key={scene.index}
            studio={studio}
            scene={scene}
            panel={focus.panel}
            setPanel={(panel) => go({ panel })}
          />
        </div>
      </main>
      <FactStrip studio={studio} select={select} />
    </>
  );
}

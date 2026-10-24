"use client";

import { cn } from "cn";
import {
  ArrowLeft,
  Check,
  CloudAlert,
  Download,
  History,
  Loader2,
  Mic,
  Pencil,
  Redo2,
  RefreshCw,
  Share2,
  Sparkles,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { listVersions } from "@/app/(app)/edit-actions";
import { IconRail, type SidebarUser } from "@/components/app/sidebar";
import { Soon } from "@/components/app/soon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VersionItem, VideoView } from "@/lib/videos";
import { Editor } from "./editor";
import { StoryboardView } from "./storyboard";
import { FPS } from "./studio-shared";
import { type Studio as StudioState, useStudio } from "./use-studio";

export type Tab = "storyboard" | "edit";
export type Focus = { tab: Tab; scene: number; panel: "script" | "visual" };

const sourceLabel: Record<string, string> = {
  generated: "Written by AI",
  "factcheck-rewrite": "Fixed by the fact-check",
  "scene-regenerated": "Scene rewritten with AI",
  "user-edit": "Edited",
  restored: "Restored an earlier version",
  reordered: "Scenes reordered",
  "scene-added": "Scene added",
  "scene-deleted": "Scene deleted",
};

const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

const iconButton =
  "grid size-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-paper hover:text-ink disabled:pointer-events-none disabled:opacity-35";

/** Title with the rename pencil (Enter or leaving the field saves, Escape cancels). */
function Title({ studio }: { studio: StudioState }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(studio.video.title);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);
  const done = async (keep: boolean) => {
    setEditing(false);
    if (keep && value.trim() && value.trim() !== studio.video.title) {
      if (!(await studio.rename(value))) setValue(studio.video.title);
    } else setValue(studio.video.title);
  };
  if (editing) {
    return (
      <input
        ref={input}
        value={value}
        maxLength={60}
        aria-label="Video title"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void done(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void done(true);
          if (e.key === "Escape") void done(false);
        }}
        className="w-[22rem] max-w-full rounded-md border border-line bg-panel px-2 py-0.5 font-heading text-[18px] font-semibold tracking-tight outline-none focus:border-ink"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setValue(studio.video.title);
        setEditing(true);
      }}
      className="group flex min-w-0 items-center gap-2 text-left"
      aria-label="Rename video"
    >
      <h1 className="max-w-[22rem] truncate text-[18px] font-semibold tracking-tight">{studio.video.title}</h1>
      <Pencil className="size-4 shrink-0 text-ink-3 transition-colors group-hover:text-ink" strokeWidth={1.75} />
    </button>
  );
}

function SaveBadge({ state }: { state: StudioState["save"] }) {
  if (state === "saving")
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-ink-3">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    );
  if (state === "saved")
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-teal-ink">
        <Check className="size-3" strokeWidth={2.5} /> Saved
      </span>
    );
  if (state === "error")
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-red-ink">
        <CloudAlert className="size-3" /> Not saved
      </span>
    );
  return null;
}

/** Undo, redo and the version history menu. */
function HistoryTools({ studio }: { studio: StudioState }) {
  const [versions, setVersions] = useState<VersionItem[] | null>(null);
  const load = async () => {
    setVersions(null);
    const res = await listVersions({ videoId: studio.video.id });
    setVersions(res.ok ? res.data.versions : []);
  };
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => void studio.undo()}
        disabled={!studio.canUndo}
        className={iconButton}
        aria-label="Undo"
        title="Undo"
      >
        <Undo2 className="size-[18px]" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => void studio.redo()}
        disabled={!studio.canRedo}
        className={iconButton}
        aria-label="Redo"
        title="Redo"
      >
        <Redo2 className="size-[18px]" strokeWidth={1.75} />
      </button>
      <DropdownMenu onOpenChange={(open) => open && void load()}>
        <DropdownMenuTrigger className={iconButton} aria-label="Version history" title="Version history">
          <History className="size-[18px]" strokeWidth={1.75} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto">
          <DropdownMenuLabel className="font-normal text-ink-2">Version history</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {versions === null ? (
            <div className="flex items-center gap-2 px-2 py-3 text-xs text-ink-3">
              <Loader2 className="size-3.5 animate-spin" /> Loading…
            </div>
          ) : (
            versions.map((v) => {
              const current = v.version === studio.video.scriptVersion;
              return (
                <DropdownMenuItem
                  key={v.version}
                  disabled={current}
                  onSelect={() => void studio.restore(v.version)}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-ink">
                      {sourceLabel[v.source] ?? "Changed"}
                      {v.changedScenes.length && v.source !== "generated"
                        ? ` · scene ${v.changedScenes.map((i) => i + 1).join(", ")}`
                        : ""}
                    </span>
                    <span className="block text-[11px] text-ink-3">
                      Version {v.version} · {ago(v.createdAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-ink-2">{current ? "Current" : "Restore"}</span>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Soon>
        <button type="button" disabled className={iconButton} aria-label="Share">
          <Share2 className="size-[18px]" strokeWidth={1.75} />
        </button>
      </Soon>
    </div>
  );
}

function TopBar({ studio, tab, onTab }: { studio: StudioState; tab: Tab; onTab: (t: Tab) => void }) {
  const total = studio.video.timeline?.durationInFrames ?? 0;
  return (
    <header className="z-30 flex min-h-16 sm:sticky sm:top-0 w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-panel px-4 py-3 select-none sm:px-8 xl:h-16 xl:flex-nowrap xl:py-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 xl:flex-nowrap">
        <Link
          href="/videos"
          aria-label="Back to videos"
          className="grid place-items-center rounded-lg p-2 text-ink-2 transition-colors hover:bg-paper hover:text-ink"
        >
          <ArrowLeft className="size-[18px]" strokeWidth={1.75} />
        </Link>
        <Title studio={studio} />
        <SaveBadge state={studio.save} />
        <span className="mx-1 hidden h-4 w-px bg-line sm:block" />
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink-2">
            <span className="size-1.5 rounded-full bg-teal" />
            Preview ready
          </span>
          <span className="inline-flex items-center rounded-md border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink-2 tabular-nums">
            {Math.round(total / FPS)}s
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink-2">
            <Mic className="size-[15px]" strokeWidth={1.75} />
            Voice: {studio.video.voiceName}
          </span>
        </div>
        <div className="flex shrink-0 items-center rounded-lg border border-line bg-paper p-1">
          {(["storyboard", "edit"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => onTab(t)}
              className={cn(
                "rounded-md px-3.5 py-1 text-xs font-medium transition-colors",
                tab === t ? "bg-ink text-white shadow-xs" : "text-ink-2 hover:text-ink",
              )}
            >
              {t === "storyboard" ? "Storyboard" : "Edit"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 whitespace-nowrap xl:shrink-0 xl:flex-nowrap">
        <HistoryTools studio={studio} />
        <span className="hidden h-6 w-px bg-line md:block" />
        <Soon>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3.5 py-2 text-xs font-medium text-ink shadow-xs"
          >
            {tab === "edit" ? (
              <Download className="size-4" strokeWidth={1.75} />
            ) : (
              <RefreshCw className="size-4" strokeWidth={1.75} />
            )}
            {tab === "edit" ? "Export Draft" : "Regenerate"}
          </button>
        </Soon>
        <div className="flex flex-col items-end">
          <Soon label="Rendering with voice arrives soon">
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 rounded-lg bg-lime px-4 py-2 text-xs font-semibold text-ink shadow-[0_0_20px_rgba(198,244,50,0.35)]"
            >
              <Sparkles className="size-[17px]" strokeWidth={1.75} />
              Render Video
            </button>
          </Soon>
          <span className="mt-1 text-[11px] font-medium text-ink-3">Rendering arrives soon</span>
        </div>
      </div>
    </header>
  );
}

/**
 * A finished video's workspace: the Storyboard (every scene at a glance) and the Editor share one top bar,
 * one copy of the video and its autosave. Covers the app's sidebar: it uses Stitch's 64px icon rail instead.
 */
export function Studio({
  video: initial,
  user,
  usage,
  focus: initialFocus,
}: {
  video: VideoView;
  user: SidebarUser;
  usage: { used: number; limit: number };
  focus: Focus;
}) {
  const studio = useStudio(initial);
  const [focus, setFocus] = useState<Focus>(initialFocus);

  // Keep the tab and scene in the address bar (no server round trip), so reload and back land in the same place.
  const go = (next: Partial<Focus>) => setFocus((f) => ({ ...f, ...next }));
  // biome-ignore lint/correctness/useExhaustiveDependencies: `initial` changes on a refresh (after a fact re-check), which can put back the address the page loaded with
  useEffect(() => {
    const url = new URL(window.location.href);
    if (focus.tab === "edit") {
      url.searchParams.set("tab", "edit");
      url.searchParams.set("scene", String(focus.scene + 1));
    } else {
      url.searchParams.delete("tab");
      url.searchParams.delete("scene");
    }
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [focus.tab, focus.scene, initial]);

  // A scene removed or the list shortened: keep the selection inside the list.
  const count = studio.video.scenes.length;
  useEffect(() => {
    if (focus.scene >= count) setFocus((f) => ({ ...f, scene: Math.max(0, count - 1) }));
  }, [count, focus.scene]);

  if (!studio.video.timeline) return null;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-paper">
      <IconRail user={user} usage={usage} />
      <div className="flex min-h-screen flex-col lg:pl-16">
        <TopBar studio={studio} tab={focus.tab} onTab={(tab) => go({ tab })} />
        {studio.conflict && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FDE68A] bg-amber-soft px-4 py-2.5 text-[13px] text-amber-ink sm:px-8"
          >
            <span>This video changed in another tab. Reload to see the latest; your last change wasn't saved.</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-[#FDE68A] bg-panel px-3 py-1 text-xs font-medium text-ink"
            >
              Reload
            </button>
          </div>
        )}
        {focus.tab === "edit" ? (
          <Editor studio={studio} focus={focus} go={go} />
        ) : (
          <StoryboardView studio={studio} open={(scene, panel = "script") => go({ tab: "edit", scene, panel })} />
        )}
      </div>
    </div>
  );
}

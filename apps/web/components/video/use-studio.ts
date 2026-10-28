"use client";

import type { ActionResult } from "@clipwise/shared";
import type { VisualColor, VisualType } from "@clipwise/video";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { acceptClaim } from "@/app/(app)/actions";
import {
  addScene,
  deleteScene,
  renameVideo,
  reorderScenes,
  restoreVersion,
  rewriteScene,
  updateScene,
} from "@/app/(app)/edit-actions";
import { renderFinal } from "@/app/(app)/render-actions";
import { onVideoEvent } from "@/lib/video-events";
import type { VideoView } from "@/lib/videos";

type Scene = VideoView["scenes"][number];
/** Text fields autosaved while typing. */
export type TextPatch = { narration?: string; onScreenText?: string[]; stat?: { value: string; label: string } };
type Edited = ActionResult<{ video: VideoView }>;
export type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 900;

const applyText = (scene: Scene, patch: TextPatch): Scene => ({
  ...scene,
  ...(patch.narration !== undefined ? { narration: patch.narration } : {}),
  ...(patch.onScreenText !== undefined ? { onScreenText: patch.onScreenText } : {}),
  ...(patch.stat !== undefined ? { stat: patch.stat } : {}),
});

/**
 * The Storyboard and Editor share one copy of the video. Typing changes it at once and is autosaved shortly
 * after; every save (and every other edit) runs one at a time, in order, with the version the last save
 * returned, so the browser never conflicts with itself. Undo/redo restore earlier versions.
 */
export function useStudio(initial: VideoView) {
  const router = useRouter();
  const [video, setVideo] = useState(initial);
  const [rendering, setRendering] = useState(false);
  const renderingRef = useRef(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [conflict, setConflict] = useState(false);
  const [busyScene, setBusyScene] = useState<number | null>(null); // AI rewriting this scene
  const [undoStack, setUndo] = useState<number[]>([]);
  const [redoStack, setRedo] = useState<number[]>([]);

  const version = useRef(initial.scriptVersion);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const drafts = useRef(new Map<number, TextPatch>()); // typed, not sent yet
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(0);
  const conflictRef = useRef(false);

  /** A fresh copy from the server, with anything typed since (not saved yet) laid back on top. */
  const adopt = useCallback((view: VideoView) => {
    version.current = view.scriptVersion;
    setVideo({
      ...view,
      scenes: view.scenes.map((s) => {
        const d = drafts.current.get(s.index);
        return d ? applyText(s, d) : s;
      }),
    });
  }, []);

  // Server data changed (another tab, a finished fact re-check): take it when nothing local is pending.
  useEffect(() => {
    if (drafts.current.size || inFlight.current) return;
    if (initial.scriptVersion < version.current) return;
    adopt(initial);
  }, [initial, adopt]);

  /** Queues a server call after everything before it; the latest version is filled in when it runs. */
  const run = useCallback(
    (call: (expectedVersion: number) => Promise<Edited>, opts: { undoable?: boolean; scene?: number } = {}) => {
      const task = chain.current.then(async () => {
        if (conflictRef.current) return false;
        inFlight.current++;
        setSave("saving");
        if (opts.scene !== undefined) setBusyScene(opts.scene);
        const before = version.current;
        try {
          const res = await call(before);
          if (res.ok) {
            adopt(res.data.video);
            if (opts.undoable) {
              setUndo((u) => [...u.slice(-49), before]);
              setRedo([]);
            }
            setSave("saved");
            return true;
          }
          setSave("error");
          if (res.error.code === "CONFLICT") {
            conflictRef.current = true;
            setConflict(true);
          } else toast.error(res.error.message);
          return false;
        } catch {
          setSave("error");
          toast.error("Couldn't save. Check your connection and try again.");
          return false;
        } finally {
          inFlight.current--;
          if (opts.scene !== undefined) setBusyScene(null);
        }
      });
      chain.current = task;
      return task;
    },
    [adopt],
  );

  /** Sends valid drafts in order. Failed/invalid drafts stay pending, so rendering can't silently skip them. */
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const pending = [...drafts.current.entries()];
    drafts.current.clear();
    for (const [sceneIndex, patch] of pending) {
      if (
        (patch.narration !== undefined && !patch.narration.trim()) ||
        (patch.onScreenText !== undefined && !patch.onScreenText.some((l) => l.trim())) ||
        (patch.stat !== undefined && !/\d/.test(patch.stat.value))
      ) {
        drafts.current.set(sceneIndex, patch);
        setSave("error");
        continue;
      }
      const task = run((v) => updateScene({ videoId: video.id, expectedVersion: v, sceneIndex, patch }), {
        undoable: true,
      });
      chain.current = task.then((ok) => {
        if (!ok) drafts.current.set(sceneIndex, { ...patch, ...drafts.current.get(sceneIndex) });
        return ok;
      });
    }
    return chain.current.then(() => !drafts.current.size && !conflictRef.current);
  }, [run, video.id]);

  /** Typing: shown at once, saved shortly after the user pauses. */
  const type = useCallback(
    (sceneIndex: number, patch: TextPatch) => {
      drafts.current.set(sceneIndex, { ...drafts.current.get(sceneIndex), ...patch });
      setVideo((v) => ({ ...v, scenes: v.scenes.map((s) => (s.index === sceneIndex ? applyText(s, patch) : s)) }));
      setSave("idle");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush],
  );

  // Save what's typed before the page goes away.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && void flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  /** Any non-typing edit: first saves what's typed, then runs. */
  const edit = useCallback(
    async (call: (expectedVersion: number) => Promise<Edited>, scene?: number) => {
      if (!(await flush())) return false;
      return run(call, { undoable: true, scene });
    },
    [flush, run],
  );

  const id = video.id;
  const actions = {
    startRender: async () => {
      if (renderingRef.current) return;
      renderingRef.current = true;
      setRendering(true);
      try {
        if (!(await flush())) {
          toast.error("Save or fix your pending edits before rendering.");
          return;
        }
        const res = await renderFinal({ videoId: id, expectedVersion: version.current });
        if (!res.ok) toast.error(res.error.message);
        else router.push(`/videos/${id}`);
        router.refresh();
      } catch {
        toast.error("Couldn't start rendering. Try again.");
      } finally {
        renderingRef.current = false;
        setRendering(false);
      }
    },
    setLayout: (sceneIndex: number, template: "title" | "bullets" | "stat", stat?: { value: string; label: string }) =>
      edit((v) =>
        updateScene({ videoId: id, expectedVersion: v, sceneIndex, patch: { template, ...(stat ? { stat } : {}) } }),
      ),
    setVisual: (sceneIndex: number, patch: { visualType?: VisualType; color?: VisualColor }) =>
      edit((v) => updateScene({ videoId: id, expectedVersion: v, sceneIndex, patch })),
    rewrite: (sceneIndex: number, instruction?: string) =>
      edit((v) => rewriteScene({ videoId: id, expectedVersion: v, sceneIndex, instruction }), sceneIndex),
    add: (afterIndex: number, mode: "blank" | "ai") =>
      edit(
        (v) => addScene({ videoId: id, expectedVersion: v, afterIndex, mode }),
        mode === "ai" ? afterIndex + 1 : undefined,
      ),
    remove: (sceneIndex: number) => edit((v) => deleteScene({ videoId: id, expectedVersion: v, sceneIndex })),
    reorder: (order: number[]) => edit((v) => reorderScenes({ videoId: id, expectedVersion: v, order })),
    restore: (target: number) => edit((v) => restoreVersion({ videoId: id, expectedVersion: v, version: target })),
    undo: async () => {
      const beforeFlush = version.current;
      if (!(await flush())) return;
      const target = beforeFlush !== version.current ? beforeFlush : undoStack.at(-1);
      if (target === undefined) return;
      const from = version.current;
      const ok = await run((v) => restoreVersion({ videoId: id, expectedVersion: v, version: target }));
      if (ok) {
        setUndo((u) => u.slice(0, -1));
        setRedo((r) => [...r, from]);
      }
    },
    redo: async () => {
      const target = redoStack.at(-1);
      if (target === undefined) return;
      if (!(await flush())) return;
      const from = version.current;
      const ok = await run((v) => restoreVersion({ videoId: id, expectedVersion: v, version: target }));
      if (ok) {
        setRedo((r) => r.slice(0, -1));
        setUndo((u) => [...u, from]);
      }
    },
    rename: async (title: string) => {
      const res = await renameVideo({ videoId: id, title });
      if (res.ok) setVideo((v) => ({ ...v, title: res.data.title }));
      else toast.error(res.error.message);
      return res.ok;
    },
    /** "Mark as OK": the user checked the note. Not a script change, so no version and no undo. */
    acceptClaim: async (claimIndex: number) => {
      setVideo((v) => ({
        ...v,
        claims: v.claims.map((c) => (c.index === claimIndex ? { ...c, accepted: true } : c)),
        scenes: v.scenes.map((s) => ({ ...s, claims: s.claims.filter((c) => c.index !== claimIndex) })),
      }));
      const res = await acceptClaim({ videoId: id, claimIndex });
      if (!res.ok) toast.error(res.error.message);
    },
  };

  // Live updates: a finished fact re-check, or an edit made in another tab.
  useEffect(() => {
    const source = new EventSource(`/api/events/${id}`);
    const refresh = () => router.refresh();
    for (const event of ["claims", "status", "done", "error"] as const) onVideoEvent(source, event, refresh);
    onVideoEvent(source, "script", (e) => {
      if (e.type === "script" && e.scriptVersion > version.current) refresh(); // not our own save
    });
    return () => source.close();
  }, [id, router]);

  return {
    video,
    rendering,
    save,
    conflict,
    busyScene,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    type,
    flush,
    ...actions,
  };
}

export type Studio = ReturnType<typeof useStudio>;

// Editing rules for a written script: pure functions (no I/O), shared by the web app's edit actions and tests.
// Every function returns a new script; the input is never changed.

import { type VisualColor, VisualColors } from "@clipwise/video";
import { repairVisual } from "./stages/validate";
import type { Scene, Script, Visual } from "./types";

/** A video keeps between 3 and 10 scenes while editing (the generator's own range is narrower). */
export const EDIT_SCENES = { min: 3, max: 10 } as const;
export const MAX_NARRATION = 400;
export const MAX_LINE = 60;
export const MAX_TITLE = 60;

export class EditError extends Error {}

export type ScenePatch = {
  narration?: string;
  onScreenText?: string[];
  /** Layout: title, bullets (points) or stat (big number). imageFocus is kept only if the scene already has it. */
  template?: Scene["template"];
  stat?: { value: string; label: string };
  visual?: Visual;
};

/** Claims stored on the video, attached to a scene by its index. */
export type StoredClaim = { scene: number; text: string; verdict: string; fix: string; acceptedAt: Date | null };

const clone = (script: Script): Script => structuredClone(script);

/** Hook and CTA are copies of what the first and last scenes say; keep them in sync after any edit. */
const syncBookkeeping = (script: Script) => {
  script.scenes.forEach((s, i) => {
    s.index = i;
  });
  const first = script.scenes[0];
  if (first) script.hook = first.narration.trim();
  const last = script.scenes.at(-1);
  if (last)
    script.cta =
      last.narration
        .trim()
        .split(/(?<=[.!?])\s+/)
        .at(-1) ?? last.narration.trim();
  return script;
};

const sceneAt = (script: Script, index: number) => {
  const scene = script.scenes[index];
  if (!scene) throw new EditError("This scene doesn't exist anymore.");
  return scene;
};

/** The parts of a scene a viewer sees or hears as facts (what the fact-check reads). */
const checkable = (s: Scene | undefined) =>
  s
    ? JSON.stringify({
        n: s.narration.trim(),
        t: s.onScreenText,
        s: s.stat ?? null,
        b: s.visual?.type === "bars" ? s.visual.items?.map((i) => [i.label, i.value]) : null,
      })
    : "";

/** Indexes of scenes in `after` whose checkable content differs from the scene at the same index in `before`. */
export const changedForFactcheck = (before: Script, after: Script) =>
  after.scenes.filter((s, i) => checkable(s) !== checkable(before.scenes[i])).map((s) => s.index);

/** A visual that fits its type's rules, built from what the scene already has (labels from its text lines). */
export const switchVisual = (scene: Scene, type: Visual["type"], color?: VisualColor): Visual => {
  const old = scene.visual;
  const items = old?.items ?? [];
  const main = old?.icon ?? items.find((i) => i.icon)?.icon ?? "sparkles";
  const fallbackIcons = ["sparkles", "lightbulb", "target", "rocket"];
  const labels = [...items.map((i) => i.label).filter((l): l is string => !!l), ...scene.onScreenText];
  const pick = (n: number, withLabel = true) =>
    Array.from({ length: n }, (_, k) => ({
      icon: items[k]?.icon ?? fallbackIcons[k % fallbackIcons.length],
      ...(withLabel ? { label: (labels[k] ?? `Step ${k + 1}`).slice(0, 18) } : {}),
    }));
  const keepColor = color ?? old?.color;
  const base = { type, ...(keepColor ? { color: keepColor } : {}) };
  const between = (min: number, max: number) => Math.min(max, Math.max(min, labels.length || min));
  switch (type) {
    case "icon":
      return { ...base, icon: main };
    case "orbit":
      return { ...base, icon: main, items: items.filter((i) => i.icon).slice(0, 6) };
    case "particles":
      return { ...base, icon: main, motion: old?.motion ?? "scatter" };
    case "network":
      return { ...base, icon: main, items: pick(Math.min(4, Math.max(2, items.length)), false) };
    case "waves":
      return { ...base, items: pick(between(1, 3)).map(({ label }) => ({ label })) };
    case "flow":
      return { ...base, items: pick(between(2, 4)) };
    case "compare":
      return { ...base, items: pick(2) };
    case "cycle":
      return { ...base, items: pick(between(3, 4)) };
    case "bars":
      // Bars show data: only possible when the scene already has numbers (never invented here).
      if (!canUseBars(scene)) throw new EditError("A bar chart needs numbers. Use Rewrite with AI to add them.");
      return { ...base, items: items.slice(0, 4) };
  }
};

export const canUseBars = (scene: Scene) =>
  (scene.visual?.items?.filter((i) => typeof i.value === "number" && i.label).length ?? 0) >= 2;

export const isVisualColor = (c: string): c is VisualColor => (VisualColors as readonly string[]).includes(c);

/** Changes one scene's text, layout or visual. Returns the new script. */
export function editScene(script: Script, index: number, patch: ScenePatch): Script {
  const next = clone(script);
  const scene = sceneAt(next, index);
  if (patch.narration !== undefined) {
    const narration = patch.narration.trim();
    if (!narration) throw new EditError("The narration can't be empty.");
    if (narration.length > MAX_NARRATION) throw new EditError(`Keep the narration under ${MAX_NARRATION} characters.`);
    scene.narration = narration;
  }
  if (patch.onScreenText !== undefined) {
    const lines = patch.onScreenText.map((l) => l.trim()).filter(Boolean);
    if (!lines.length) throw new EditError("Add at least one on-screen line.");
    if (lines.length > 3) throw new EditError("Use at most 3 on-screen lines.");
    if (lines.some((l) => l.length > MAX_LINE)) throw new EditError(`Keep each line under ${MAX_LINE} characters.`);
    scene.onScreenText = lines;
  }
  if (patch.template !== undefined && patch.template !== scene.template) {
    if (patch.template === "imageFocus") throw new EditError("Photo scenes aren't available yet.");
    if (patch.template === "stat") {
      const stat = patch.stat ?? scene.stat;
      if (!stat) throw new EditError("Add the number to show.");
      scene.stat = stat;
      delete scene.visual;
    } else {
      delete scene.stat;
      if (scene.template === "imageFocus") delete scene.imageQuery;
      scene.visual ??= { type: "icon", icon: "sparkles" };
    }
    scene.template = patch.template;
  }
  if (patch.stat !== undefined) {
    if (scene.template !== "stat") throw new EditError("Only big-number scenes have a number.");
    const value = patch.stat.value.trim();
    if (!/\d/.test(value) || value.length > 6)
      throw new EditError("The number must contain a digit and be at most 6 characters (e.g. 92%).");
    scene.stat = { value, label: patch.stat.label.trim().slice(0, 40) };
  }
  if (patch.visual !== undefined) {
    if (scene.template === "stat") throw new EditError("Big-number scenes show the number instead of a visual.");
    scene.visual = structuredClone(patch.visual);
    repairVisual(scene);
  }
  return syncBookkeeping(next);
}

/** Puts scenes in a new order. `order[i]` is the current index of the scene that goes to position i. */
export function reorderScenes(script: Script, order: number[]): { script: Script; moved: Map<number, number> } {
  const n = script.scenes.length;
  const valid = order.length === n && new Set(order).size === n && order.every((i) => i >= 0 && i < n);
  if (!valid) throw new EditError("The scene order is out of date. Reload and try again.");
  if (order[0] !== 0) throw new EditError("The hook stays the first scene.");
  const next = clone(script);
  next.scenes = order.map((i) => structuredClone(script.scenes[i]!));
  const moved = new Map(order.map((from, to) => [from, to]));
  return { script: syncBookkeeping(next), moved };
}

/** A blank scene to fill in (by typing, or with AI right after). */
export const blankScene = (index: number): Scene => ({
  index,
  narration: "Write what the voice says in this scene.",
  template: "bullets",
  onScreenText: ["New scene"],
  visual: { type: "icon", icon: "sparkles" },
});

/** Adds a scene after `afterIndex` (never before the hook). */
export function addScene(script: Script, afterIndex: number, scene?: Scene) {
  if (script.scenes.length >= EDIT_SCENES.max)
    throw new EditError(`A video can have at most ${EDIT_SCENES.max} scenes.`);
  if (afterIndex < 0 || afterIndex >= script.scenes.length) throw new EditError("Pick where to add the scene.");
  const next = clone(script);
  const at = afterIndex + 1;
  next.scenes.splice(at, 0, scene ? structuredClone(scene) : blankScene(at));
  const moved = new Map(script.scenes.map((_, i) => [i, i < at ? i : i + 1]));
  return { script: syncBookkeeping(next), moved, index: at };
}

/** Deletes a scene (not the hook; at least 3 stay). */
export function deleteScene(script: Script, index: number) {
  sceneAt(script, index);
  if (index === 0) throw new EditError("The hook can't be deleted. Edit it instead.");
  if (script.scenes.length <= EDIT_SCENES.min) throw new EditError(`A video needs at least ${EDIT_SCENES.min} scenes.`);
  const next = clone(script);
  next.scenes.splice(index, 1);
  const moved = new Map(
    script.scenes.flatMap((_, i) => (i === index ? [] : [[i, i < index ? i : i - 1] as [number, number]])),
  );
  return { script: syncBookkeeping(next), moved };
}

/** Claims follow their scene after a reorder, add or delete; claims of a deleted scene are dropped. */
export const moveClaims = (claims: StoredClaim[], moved: Map<number, number>) =>
  claims.flatMap((c) => {
    const to = moved.get(c.scene);
    return to === undefined ? [] : [{ ...c, scene: to }];
  });

/**
 * Fact-check bookkeeping after an edit: scenes whose facts changed lose their old claims and wait for a re-check
 * (`pending`); scenes already waiting keep waiting (following their new position).
 */
export function afterEdit(opts: {
  claims: StoredClaim[];
  pending: number[];
  changed: number[];
  moved?: Map<number, number>;
}) {
  const moved = opts.moved ?? new Map<number, number>();
  const follow = (i: number) => (opts.moved ? moved.get(i) : i);
  const claims = opts.moved ? moveClaims(opts.claims, moved) : opts.claims;
  const pending = new Set<number>(opts.pending.map(follow).filter((i): i is number => i !== undefined));
  for (const i of opts.changed) pending.add(i);
  return {
    claims: claims.filter((c) => !pending.has(c.scene)),
    pending: [...pending].sort((a, b) => a - b),
  };
}

/** Renames the video (the script title is the video title). */
export function renameScript(script: Script, title: string) {
  const t = title.trim();
  if (!t) throw new EditError("The title can't be empty.");
  if (t.length > MAX_TITLE) throw new EditError(`Keep the title under ${MAX_TITLE} characters.`);
  return { ...clone(script), title: t };
}

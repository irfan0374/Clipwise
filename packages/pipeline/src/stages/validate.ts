import { isKnownIcon } from "@clipwise/video/icons";
import { type Length, lengthRules, type Script, ScriptSchema, type Visual, WORD_FLOOR } from "../types";

const MAX_LABEL = 18;

/** Item rules per visual type: how many items, and which fields each needs. */
const visualRules: Record<
  Visual["type"],
  { min: number; max: number; needs: ("icon" | "label" | "value")[]; mainIcon?: boolean; motion?: boolean }
> = {
  icon: { min: 0, max: 0, needs: [], mainIcon: true },
  flow: { min: 2, max: 4, needs: ["icon", "label"] },
  compare: { min: 2, max: 2, needs: ["icon", "label"] },
  bars: { min: 2, max: 4, needs: ["label", "value"] },
  orbit: { min: 0, max: 6, needs: [], mainIcon: true },
  waves: { min: 1, max: 3, needs: ["label"] },
  particles: { min: 0, max: 0, needs: [], motion: true },
  network: { min: 0, max: 4, needs: ["icon"] },
  cycle: { min: 3, max: 4, needs: ["icon", "label"] },
};

const shorten = (label: string) => {
  if (label.length <= MAX_LABEL) return label;
  const words = label.split(/\s+/);
  let out = "";
  for (const w of words) {
    if ((out ? `${out} ${w}` : w).length > MAX_LABEL) break;
    out = out ? `${out} ${w}` : w;
  }
  return out || label.slice(0, MAX_LABEL);
};

/**
 * Repairs a scene's visual in place instead of rejecting the script (each Gemini retry costs free daily quota).
 * Fixable issues are fixed; anything else falls back to a single-icon visual. Returns what was changed.
 */
export const repairVisual = (scene: Script["scenes"][number]): string | null => {
  const where = `scene ${scene.index}`;
  if (scene.template === "stat" || scene.template === "imageFocus") {
    if (!scene.visual) return null;
    delete scene.visual;
    return `${where}: removed visual from ${scene.template} scene`;
  }
  const visual = scene.visual;
  if (!visual) {
    scene.visual = { type: "icon", icon: "sparkles" };
    return `${where}: no visual, used a sparkles icon`;
  }

  const rule = visualRules[visual.type];
  const notes: string[] = [];
  if (visual.items && visual.items.length > rule.max) {
    visual.items = visual.items.slice(0, rule.max);
    notes.push(`trimmed to ${rule.max} items`);
  }
  for (const item of visual.items ?? []) {
    if (item.label && item.label.length > MAX_LABEL) {
      item.label = shorten(item.label);
      notes.push("shortened a label");
    }
  }
  if (rule.motion && !visual.motion) {
    visual.motion = "scatter";
    notes.push("added scatter motion");
  }
  const items = visual.items ?? [];
  if (rule.mainIcon && !visual.icon) visual.icon = items.find((i) => i.icon)?.icon;

  const usable =
    items.length >= rule.min &&
    items.every((item) => rule.needs.every((field) => item[field] !== undefined && item[field] !== "")) &&
    (!rule.mainIcon || Boolean(visual.icon));
  if (!usable) {
    const icon = visual.icon ?? items.find((i) => i.icon)?.icon ?? "sparkles";
    scene.visual = { type: "icon", icon, ...(visual.color ? { color: visual.color } : {}) };
    notes.push(`${visual.type} was incomplete, used a single icon`);
  }
  return notes.length ? `${where}: ${notes.join(", ")}` : null;
};

/** Unknown icon names are swapped for "sparkles" rather than failing the script; returns the names replaced. */
export const fixUnknownIcons = (script: Script) => {
  const replaced: string[] = [];
  const check = (name: string | undefined) => {
    if (!name || isKnownIcon(name)) return name;
    replaced.push(name);
    return "sparkles";
  };
  for (const scene of script.scenes) {
    if (!scene.visual) continue;
    scene.visual.icon = check(scene.visual.icon);
    for (const item of scene.visual.items ?? []) item.icon = check(item.icon);
  }
  return replaced;
};

export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export const narrationWords = (script: Script) => script.scenes.reduce((sum, s) => sum + countWords(s.narration), 0);

export type ValidationResult =
  | { ok: true; script: Script; repairs: string[] }
  | {
      ok: false;
      errors: string[];
      wordCount?: number;
      /** Set when the shape was valid and the word count is the only problem, so the script can be fixed up. */
      lengthOnly?: { script: Script; minWords: number; maxWords: number; repairs: string[] };
    };

// Checks shape first, then the rules a schema can't express. Errors are written so they can be fed back to Gemini.
export const validateScript = (raw: unknown, length: Length, { images = true } = {}): ValidationResult => {
  const parsed = ScriptSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`) };
  }

  const script = parsed.data;
  const rules = lengthRules[length];
  const errors: string[] = [];

  // Bookkeeping fields are repaired, not rejected: they are copies of what the scenes already say.
  const fixes: string[] = [];
  if (script.lengthSeconds !== length) {
    script.lengthSeconds = length;
    fixes.push(`lengthSeconds set to ${length}`);
  }
  const first = script.scenes[0];
  if (first && first.narration.trim() !== script.hook.trim()) {
    script.hook = first.narration.trim();
    fixes.push("hook synced to scene 1");
  }
  const last = script.scenes.at(-1);
  if (last && !last.narration.trim().endsWith(script.cta.trim())) {
    const sentences = last.narration.trim().split(/(?<=[.!?])\s+/);
    script.cta = sentences.at(-1) ?? last.narration.trim();
    fixes.push("cta taken from the last scene");
  }

  // Accept ~10% either side of the asked-for budget; voice speed correction handles the rest.
  const words = narrationWords(script);
  const tooShort = words < Math.round(rules.minWords * WORD_FLOOR);
  const tooLong = words > Math.round(rules.maxWords * 1.2);
  if (tooShort) {
    errors.push(
      `You wrote ${words} words of narration; you need at least ${rules.minWords} (aim for ${rules.maxWords}). Add about ${rules.maxWords - words} words: make every scene's narration one sentence longer.`,
    );
  }
  if (tooLong) {
    errors.push(
      `You wrote ${words} words of narration; the maximum is ${rules.maxWords}. Remove about ${words - rules.maxWords} words: shorten the longest scenes.`,
    );
  }

  const sceneCount = script.scenes.length;
  const [fewest, most] = rules.allowedScenes;
  const badSceneCount = sceneCount < fewest || sceneCount > most;
  if (badSceneCount) {
    errors.push(
      `You wrote ${sceneCount} scenes; write between ${rules.minScenes} and ${rules.maxScenes} (${fewest}–${most} at most).`,
    );
  }

  script.scenes.forEach((scene, i) => {
    if (scene.index !== i) errors.push(`scenes[${i}].index must be ${i}.`);
    if (scene.template === "imageFocus" && !images)
      errors.push(`scenes[${i}] uses imageFocus, which is not available; use another template.`);
    if (scene.template === "imageFocus" && !scene.imageQuery?.trim())
      errors.push(`scenes[${i}] is imageFocus but has no imageQuery.`);
    if (scene.template === "stat" && !scene.stat) errors.push(`scenes[${i}] is stat but has no stat.`);
    if (scene.stat && (!/\d/.test(scene.stat.value) || scene.stat.value.length > 6)) {
      errors.push(`scenes[${i}].stat.value "${scene.stat.value}" must contain a digit and be at most 6 characters.`);
    }
    scene.onScreenText.forEach((line, j) => {
      if (countWords(line) > 8) errors.push(`scenes[${i}].onScreenText[${j}] has more than 8 words; keep it to 6.`);
    });
  });

  if (errors.length) {
    // Only the size is off (words and/or scene count): the script can be handed back to be resized.
    const sizeErrors = Number(tooShort || tooLong) + Number(badSceneCount);
    const lengthOnly = sizeErrors > 0 && errors.length === sizeErrors;
    return {
      ok: false,
      errors,
      wordCount: words,
      ...(lengthOnly
        ? {
            lengthOnly: {
              script,
              minWords: rules.minWords,
              maxWords: rules.maxWords,
              repairs: [...fixes, ...script.scenes.map(repairVisual).filter((r): r is string => r !== null)],
            },
          }
        : {}),
    };
  }
  const repairs = [...fixes, ...script.scenes.map(repairVisual).filter((r): r is string => r !== null)];
  return { ok: true, script, repairs };
};

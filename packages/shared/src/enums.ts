// Enum values defined once and reused by Zod (API, jobs) and Mongoose (packages/db).

export const LengthModes = ["30", "60", "auto"] as const;
export const LengthSeconds = [30, 60] as const;
export const Formats = ["promo", "explainer", "story", "tips", "recap", "quote"] as const;

export const Plans = ["beta", "free", "creator", "pro", "business"] as const;
export const PaymentStatuses = ["none", "active", "past_due", "canceled"] as const;

export const VideoStatuses = [
  "draft", // created, script job queued
  "scripting", // script job running
  "checking", // fact-check job running
  "previewed", // script ready; silent preview plays in the browser
  "voicing", // voice job running
  "rendering", // render job running
  "rendered", // final MP4 ready
  "failed", // see video.error
] as const;
export const Stages = ["script", "factcheck", "voice", "render"] as const;
export const ClaimVerdicts = ["correct", "imprecise", "wrong", "unsure"] as const;

export const ScriptSources = [
  "generated",
  "factcheck-rewrite",
  "scene-regenerated",
  "user-edit",
  "restored",
  "reordered",
  "scene-added",
  "scene-deleted",
] as const;

export const RenderKinds = ["final", "preview"] as const;
export const RenderStatuses = ["queued", "rendering", "done", "failed"] as const;

export const RunTriggers = ["create", "regenerate-scene", "render", "retry"] as const;
export const RunStatuses = ["running", "ok", "failed"] as const;
/** How far a run goes: script + fact-check only, a silent preview MP4, or voice + final MP4. */
export const RunTargets = ["script", "preview", "final"] as const;
export const StageReportStatuses = ["ok", "skipped", "failed"] as const;

export const Providers = ["gemini", "elevenlabs", "r2", "instagram"] as const;
export const UsageUnits = ["tokens", "characters", "credits", "requests", "bytes"] as const;

export type Plan = (typeof Plans)[number];
export type VideoStatus = (typeof VideoStatuses)[number];
export type Stage = (typeof Stages)[number];
export type ClaimVerdict = (typeof ClaimVerdicts)[number];
export type ScriptSource = (typeof ScriptSources)[number];
export type RenderKind = (typeof RenderKinds)[number];
export type Provider = (typeof Providers)[number];
export type RunTarget = (typeof RunTargets)[number];

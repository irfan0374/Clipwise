import "server-only";
import { connectDb, PipelineRun, Render, ScriptVersion, Video } from "@clipwise/db";
import { previewTimeline, type Script, type Visual } from "@clipwise/pipeline/web";
import { type ClaimVerdict, type Format, type Stage, type VideoStatus, Voices } from "@clipwise/shared";
import { storage } from "@clipwise/storage";
import type { Timeline } from "@clipwise/video";
import type { Types } from "mongoose";

const isId = (id: string) => /^[a-f0-9]{24}$/.test(id);
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export type RecentVideo = {
  id: string;
  title: string;
  status: VideoStatus;
  createdAt: string;
  thumbnailUrl: string | null;
};

/** The workspace's latest videos for the Create screen's "Recent" strip. */
export async function recentVideos(workspaceId: Types.ObjectId, limit = 3): Promise<RecentVideo[]> {
  await connectDb();
  const videos = await Video.find(
    { workspaceId, deletedAt: null },
    { title: 1, topic: 1, status: 1, createdAt: 1, files: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return Promise.all(
    videos.map(async (v) => ({
      id: v._id.toString(),
      title: v.title || v.topic,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      thumbnailUrl: v.files?.thumbnailKey ? await storage().signedUrl(v.files.thumbnailKey) : null,
    })),
  );
}

export type StepState = "waiting" | "active" | "done" | "failed";
export type VideoView = {
  id: string;
  topic: string;
  title: string;
  format: Format;
  lengthSeconds: number | null;
  status: VideoStatus;
  stage: Stage | null;
  progress: number;
  error: { stage: string; code: string; message: string } | null;
  steps: {
    script: { state: StepState; scenes: number; words: number; ms: number | null };
    factcheck: { state: StepState; claims: number; toReview: number; rewrites: number; ms: number | null };
  };
  /** Every fact-check claim (for the editor's fact-check strip), in scene order. */
  claims: { index: number; scene: number; text: string; verdict: ClaimVerdict; fix: string; accepted: boolean }[];
  /** Bumped on every generation or edit; edits send it back (optimistic locking). */
  scriptVersion: number;
  /** Changes whenever anything about the video changes (edits, re-checks), so the client knows to resync. */
  updatedAt: string;
  scenes: {
    index: number;
    template: "title" | "bullets" | "imageFocus" | "stat";
    narration: string;
    onScreenText: string[];
    visual: Visual | null;
    stat: { value: string; label: string } | null;
    /** Edited; its facts are being checked again. */
    checking: boolean;
    /** Claims still to review in this scene (accepted ones are hidden). */
    claims: { index: number; text: string; verdict: ClaimVerdict; fix: string }[];
    startFrame: number;
    endFrame: number;
  }[];
  voiceName: string;
  /** Silent preview timeline (estimated timing), once the script exists. */
  timeline: Timeline | null;
  canCancel: boolean;
  canRetry: boolean;
  /** The latest run was cancelled by the user. */
  stopped: boolean;
};

/** One video for its owner (anyone else gets null = not found). */
export async function videoForOwner(id: string, workspaceId: Types.ObjectId): Promise<VideoView | null> {
  if (!isId(id)) return null;
  await connectDb();
  const v = await Video.findOne({ _id: id, workspaceId, deletedAt: null }).lean();
  if (!v) return null;
  const run = await PipelineRun.findOne({ videoId: v._id, trigger: { $ne: "recheck" } })
    .sort({ createdAt: -1 })
    .lean();
  const stageMs = (stage: Stage) =>
    [...(run?.stages ?? [])].reverse().find((s) => s.stage === stage && s.status === "ok")?.durationMs ?? null;

  const script = v.script;
  let timeline: Timeline | null = null;
  if (script && v.scriptVersion > 0) {
    try {
      timeline = previewTimeline(JSON.parse(JSON.stringify(script)));
    } catch (error) {
      console.error("[preview] timeline failed", error);
    }
  }
  const pending = v.factcheck?.pendingScenes ?? [];
  // Edited scenes waiting for a re-check don't make the whole fact-check "not done": the rest stays checked.
  const checked =
    v.factcheck != null &&
    v.scriptVersion > 0 &&
    (v.factcheck.checkedVersion === v.scriptVersion || pending.length > 0);
  const claims = v.factcheck?.claims ?? [];
  const failedAt = v.status === "failed" ? v.stage : null;
  const stateOf = (stage: "script" | "factcheck", done: boolean): StepState =>
    done ? "done" : failedAt === stage ? "failed" : v.stage === stage ? "active" : "waiting";

  return {
    id: v._id.toString(),
    topic: v.topic,
    title: v.title || v.topic,
    format: v.format as Format,
    lengthSeconds: v.lengthSeconds ?? null,
    status: v.status,
    stage: (v.stage as Stage | null) ?? null,
    progress: v.progress ?? 0,
    error: v.error
      ? { stage: v.error.stage ?? "", code: v.error.code ?? "INTERNAL", message: v.error.message ?? "" }
      : null,
    steps: {
      script: {
        state: stateOf("script", v.scriptVersion > 0 && !!script),
        scenes: script?.scenes.length ?? 0,
        words: script?.scenes.reduce((n, s) => n + words(s.narration), 0) ?? 0,
        ms: stageMs("script"),
      },
      factcheck: {
        state: stateOf("factcheck", checked),
        claims: claims.length,
        toReview: claims.filter((c) => c.verdict !== "correct" && !c.acceptedAt).length,
        rewrites: v.factcheck?.rewrites ?? 0,
        ms: stageMs("factcheck"),
      },
    },
    claims: claims.map((c, index) => ({
      index,
      scene: c.scene ?? 0,
      text: c.text ?? "",
      verdict: (c.verdict ?? "unsure") as ClaimVerdict,
      fix: c.fix ?? "",
      accepted: !!c.acceptedAt,
    })),
    scriptVersion: v.scriptVersion,
    updatedAt: v.updatedAt.toISOString(),
    voiceName: Voices.find((x) => x.id === v.voiceId)?.name ?? "Custom voice",
    timeline,
    scenes: (script?.scenes ?? []).map((s) => ({
      startFrame: timeline?.scenes.find((t) => t.index === s.index)?.startFrame ?? 0,
      endFrame: timeline?.scenes.find((t) => t.index === s.index)?.endFrame ?? 0,
      index: s.index,
      template: s.template as VideoView["scenes"][number]["template"],
      narration: s.narration,
      onScreenText: [...s.onScreenText],
      visual: s.visual?.type ? (JSON.parse(JSON.stringify(s.visual)) as Visual) : null,
      stat: s.stat?.value ? { value: s.stat.value, label: s.stat.label ?? "" } : null,
      checking: pending.includes(s.index),
      claims: claims
        .map((c, index) => ({ c, index }))
        .filter(({ c }) => c.scene === s.index && c.verdict !== "correct" && !c.acceptedAt)
        .map(({ c, index }) => ({
          index,
          text: c.text ?? "",
          verdict: (c.verdict ?? "unsure") as ClaimVerdict,
          fix: c.fix ?? "",
        })),
    })),
    canCancel: ["draft", "scripting", "checking"].includes(v.status) && run?.status === "running",
    canRetry: v.status === "failed",
    stopped: run?.status === "cancelled" && v.status === "draft",
  };
}

/** The current script as a plain object, for edit actions. */
export const plainScript = (script: unknown) => JSON.parse(JSON.stringify(script)) as Script;

export type VersionItem = { version: number; source: string; createdAt: string; changedScenes: number[] };

/** Recent script versions (newest first) for the editor's history menu. */
export async function scriptVersions(videoId: string, workspaceId: Types.ObjectId, limit = 20): Promise<VersionItem[]> {
  if (!isId(videoId)) return [];
  await connectDb();
  const rows = await ScriptVersion.find(
    { videoId, workspaceId },
    { version: 1, source: 1, createdAt: 1, changedScenes: 1 },
  )
    .sort({ version: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    version: r.version,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
    changedScenes: r.changedScenes ?? [],
  }));
}

export type FinalView = {
  id: string;
  scriptVersion: number;
  url: string | null;
  thumbnailUrl: string | null;
  durationMs: number;
  sizeBytes: number;
  renderMs: number;
  width: number;
  height: number;
  createdAt: string;
};

/** Most recent completed final, including an older one after the script is edited. Never another workspace's file. */
export async function finalForOwner(videoId: string, workspaceId: Types.ObjectId): Promise<FinalView | null> {
  if (!isId(videoId)) return null;
  await connectDb();
  if (!(await Video.exists({ _id: videoId, workspaceId, deletedAt: null }))) return null;
  const row = await Render.findOne({ videoId, workspaceId, kind: "final", status: "done", deletedAt: null })
    .sort({ createdAt: -1 })
    .lean();
  if (!row?.r2Key) return null;
  const store = storage();
  const exists = await store.exists(row.r2Key);
  return {
    id: row._id.toString(),
    scriptVersion: row.scriptVersion,
    url: exists ? await store.signedUrl(row.r2Key) : null,
    thumbnailUrl:
      row.thumbnailKey && (await store.exists(row.thumbnailKey)) ? await store.signedUrl(row.thumbnailKey) : null,
    durationMs: row.durationMs ?? 0,
    sizeBytes: row.sizeBytes ?? 0,
    renderMs: row.renderMs ?? 0,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
  };
}

export type LibraryItem = RecentVideo & {
  format: Format;
  duration: number | null;
  progress: number;
  finalVersion: number | null;
};

export async function listVideos(workspaceId: Types.ObjectId, query: import("./library-query").LibraryQuery) {
  const { libraryFilter } = await import("./library-query");
  await connectDb();
  const filter = libraryFilter(workspaceId, query);
  const [total, all] = await Promise.all([
    Video.countDocuments(filter),
    Video.countDocuments({ workspaceId, deletedAt: null }),
  ]);
  const pages = Math.max(1, Math.ceil(total / 12));
  const page = Math.min(query.page, pages);
  const direction = query.sort === "oldest" ? 1 : -1;
  const rows = await Video.find(filter)
    .sort({ createdAt: direction, _id: direction })
    .skip((page - 1) * 12)
    .limit(12)
    .lean();
  const finals = await Render.find(
    {
      _id: { $in: rows.map((v) => v.finalRenderId).filter(Boolean) },
      workspaceId,
      kind: "final",
      status: "done",
      deletedAt: null,
    },
    { scriptVersion: 1 },
  ).lean();
  const versions = new Map(finals.map((row) => [row._id.toString(), row.scriptVersion]));
  const items: LibraryItem[] = await Promise.all(
    rows.map(async (v) => ({
      id: v._id.toString(),
      title: v.title || v.topic,
      format: v.format as Format,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      duration: v.lengthSeconds ?? null,
      progress: v.progress ?? 0,
      thumbnailUrl: v.files?.thumbnailKey ? await storage().signedUrl(v.files.thumbnailKey) : null,
      finalVersion: v.finalRenderId ? (versions.get(v.finalRenderId.toString()) ?? null) : null,
    })),
  );
  return { items, total, all, page, pages };
}

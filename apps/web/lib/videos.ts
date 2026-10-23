import "server-only";
import { connectDb, PipelineRun, Video } from "@clipwise/db";
import type { ClaimVerdict, Format, Stage, VideoStatus } from "@clipwise/shared";
import { storage } from "@clipwise/storage";
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
  scenes: {
    index: number;
    template: string;
    narration: string;
    onScreenText: string[];
    visual: string | null;
    stat: { value: string; label: string } | null;
    claims: { text: string; verdict: ClaimVerdict; fix: string }[];
  }[];
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
  const run = await PipelineRun.findOne({ videoId: v._id }).sort({ createdAt: -1 }).lean();
  const stageMs = (stage: Stage) =>
    [...(run?.stages ?? [])].reverse().find((s) => s.stage === stage && s.status === "ok")?.durationMs ?? null;

  const script = v.script;
  const checked = v.factcheck != null && v.factcheck.checkedVersion === v.scriptVersion && v.scriptVersion > 0;
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
    scenes: (script?.scenes ?? []).map((s) => ({
      index: s.index,
      template: s.template,
      narration: s.narration,
      onScreenText: [...s.onScreenText],
      visual: s.visual?.type ?? null,
      stat: s.stat?.value ? { value: s.stat.value, label: s.stat.label ?? "" } : null,
      claims: claims
        .filter((c) => c.scene === s.index && c.verdict !== "correct")
        .map((c) => ({ text: c.text ?? "", verdict: (c.verdict ?? "unsure") as ClaimVerdict, fix: c.fix ?? "" })),
    })),
    canCancel: ["draft", "scripting", "checking"].includes(v.status) && run?.status === "running",
    canRetry: v.status === "failed",
    stopped: run?.status === "cancelled" && v.status === "draft",
  };
}

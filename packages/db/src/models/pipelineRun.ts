import { RunStatuses, RunTargets, RunTriggers, StageReportStatuses, Stages } from "@clipwise/shared";
import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel, ownerFields } from "../base";

const StageReportSchema = new Schema(
  {
    stage: { type: String, enum: Stages, required: true },
    status: { type: String, enum: StageReportStatuses, required: true },
    startedAt: Date,
    durationMs: Number,
    attempts: Number,
    units: { type: Schema.Types.Mixed, default: {} }, // e.g. { geminiTokens: 5464, model: "gemini-3.5-flash-lite" }
    error: String, // full internal error (admin only)
  },
  { _id: false },
);

/** One report per triggered chain of jobs — the database version of the prototype's run.json. */
const PipelineRunSchema = new Schema(
  {
    ...ownerFields,
    videoId: { type: Schema.Types.ObjectId, ref: "Video", required: true },
    trigger: { type: String, enum: RunTriggers, required: true },
    target: { type: String, enum: RunTargets, default: "script" }, // how far this run goes
    scriptVersion: Number,
    status: { type: String, enum: RunStatuses, default: "running" },
    stages: { type: [StageReportSchema], default: [] },
    costMicros: { type: Number, default: 0 }, // sum of this run's usageEvents
    finishedAt: Date,
  },
  baseOptions,
);
PipelineRunSchema.index({ videoId: 1, createdAt: -1 });
PipelineRunSchema.index({ status: 1, createdAt: -1 }); // admin: failure rate
PipelineRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }); // keep 90 days

export type PipelineRun = InferSchemaType<typeof PipelineRunSchema>;
export const PipelineRun = defineModel("PipelineRun", PipelineRunSchema, "pipelineRuns");

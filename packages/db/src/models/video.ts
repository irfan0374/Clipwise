import { Formats, LengthModes, LengthSeconds, Stages, VideoStatuses } from "@clipwise/shared";
import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel, ownerFields } from "../base";
import { ClaimSchema, ScriptSchema } from "./video.parts";

/**
 * One document per video: the current script, status and progress, fact-check summary and R2 keys.
 * scriptVersion drives staleness: voice is stale when voice.scriptVersion < scriptVersion,
 * the fact-check when factcheck.checkedVersion < scriptVersion.
 */
const VideoSchema = new Schema(
  {
    ...ownerFields,
    createdByUserId: { type: String, required: true },
    topic: { type: String, required: true, trim: true, maxlength: 300 },
    format: { type: String, enum: Formats, default: "explainer" },
    title: { type: String, maxlength: 60 }, // copied from script.title
    lengthMode: { type: String, enum: LengthModes, required: true },
    lengthSeconds: { type: Number, enum: [...LengthSeconds, null], default: null }, // resolved when the script is written
    voiceId: { type: String, required: true },

    status: { type: String, enum: VideoStatuses, default: "draft" },
    stage: { type: String, enum: [...Stages, null], default: null }, // stage running or failed
    progress: { type: Number, min: 0, max: 100, default: 0 },
    error: {
      type: new Schema({ stage: String, code: String, message: String, at: Date }, { _id: false }),
      default: null, // message is user-safe; details live in pipelineRuns
    },

    script: { type: ScriptSchema, default: null },
    scriptVersion: { type: Number, default: 0 }, // bumped on every generate or edit
    factcheck: {
      type: new Schema(
        {
          checkedVersion: Number,
          claims: [ClaimSchema],
          rewrites: Number,
          numbersRemovedFromScenes: [Number],
        },
        { _id: false },
      ),
      default: null,
    },
    voice: {
      type: new Schema(
        { scriptVersion: Number, voiceId: String, model: String, durationMs: Number, credits: Number },
        { _id: false },
      ),
      default: null,
    },
    files: {
      timelineKey: { type: String, default: null }, // R2 keys of the latest files
      voiceKey: { type: String, default: null },
      alignmentKey: { type: String, default: null },
      thumbnailKey: { type: String, default: null },
    },
    finalRenderId: { type: Schema.Types.ObjectId, ref: "Render", default: null },
    previewRenderId: { type: Schema.Types.ObjectId, ref: "Render", default: null },
    deletedAt: { type: Date, default: null },
  },
  baseOptions,
);
VideoSchema.index({ workspaceId: 1, deletedAt: 1, createdAt: -1 }); // dashboard list
VideoSchema.index({ status: 1, updatedAt: 1 }); // admin: stuck or failed videos
VideoSchema.index({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: { $type: "date" } } }); // cleanup job

export type Video = InferSchemaType<typeof VideoSchema>;
export const Video = defineModel("Video", VideoSchema, "videos");

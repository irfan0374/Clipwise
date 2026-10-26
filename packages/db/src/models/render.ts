import { RenderKinds, RenderStatuses } from "@clipwise/shared";
import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel, ownerFields } from "../base";

/** One per MP4 the worker produces. */
const RenderSchema = new Schema(
  {
    ...ownerFields,
    videoId: { type: Schema.Types.ObjectId, ref: "Video", required: true },
    kind: { type: String, enum: RenderKinds, required: true }, // preview = optional silent MP4
    scriptVersion: { type: Number, required: true },
    quotaAt: { type: Date, default: Date.now }, // latest final attempt; retries count in the week they run
    status: { type: String, enum: RenderStatuses, default: "queued" },
    r2Key: { type: String, default: null },
    thumbnailKey: { type: String, default: null },
    width: { type: Number, default: 1080 },
    height: { type: Number, default: 1920 },
    durationMs: Number,
    sizeBytes: Number,
    renderMs: Number, // wall-clock render time on the worker
    error: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  baseOptions,
);
RenderSchema.index({ videoId: 1, createdAt: -1 });
RenderSchema.index({ workspaceId: 1, kind: 1, createdAt: -1 }); // downloads, weekly final count

export type Render = InferSchemaType<typeof RenderSchema>;
export const Render = defineModel("Render", RenderSchema, "renders");

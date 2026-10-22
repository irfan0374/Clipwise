import { Providers, UsageUnits } from "@clipwise/shared";
import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel, ownerFields } from "../base";

/** One row per provider call that costs something. Append-only; the source of truth for cost. */
const UsageEventSchema = new Schema(
  {
    ...ownerFields,
    userId: { type: String, required: true },
    videoId: { type: Schema.Types.ObjectId, ref: "Video", default: null }, // null for brainstorm
    pipelineRunId: { type: Schema.Types.ObjectId, ref: "PipelineRun", default: null },
    provider: { type: String, enum: Providers, required: true },
    operation: { type: String, required: true }, // "script", "factcheck", "brainstorm", "voice", "publish"
    model: String, // "gemini-3.5-flash-lite", "eleven_flash_v2_5"
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: UsageUnits, required: true },
    costMicros: { type: Number, default: 0 }, // 1 USD = 1,000,000; 0 on free tiers
    freeTier: { type: Boolean, default: true },
  },
  { ...baseOptions, timestamps: { createdAt: true, updatedAt: false } },
);
UsageEventSchema.index({ workspaceId: 1, createdAt: -1 });
UsageEventSchema.index({ provider: 1, createdAt: -1 });
UsageEventSchema.index({ videoId: 1 });

export type UsageEvent = InferSchemaType<typeof UsageEventSchema>;
export const UsageEvent = defineModel("UsageEvent", UsageEventSchema, "usageEvents");

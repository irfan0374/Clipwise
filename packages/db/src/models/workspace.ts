import { Formats, LengthModes, Plans } from "@clipwise/shared";
import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel } from "../base";

/** One per user. Owns videos and usage. Clipwise is free: there is no billing. */
const WorkspaceSchema = new Schema(
  {
    ownerUserId: { type: String, required: true }, // Better Auth user id
    name: { type: String, required: true, maxlength: 80 },
    plan: { type: String, enum: Plans, default: "beta" },
    settings: {
      defaultVoiceId: { type: String, default: null },
      defaultLength: { type: String, enum: LengthModes, default: "60" },
      defaultFormat: { type: String, enum: Formats, default: "explainer" },
    },
    brandKitId: { type: Schema.Types.ObjectId, ref: "BrandKit", default: null },
    suspendedAt: { type: Date, default: null },
  },
  baseOptions,
);
WorkspaceSchema.index({ ownerUserId: 1 }, { unique: true });

export type Workspace = InferSchemaType<typeof WorkspaceSchema>;
export const Workspace = defineModel("Workspace", WorkspaceSchema, "workspaces");

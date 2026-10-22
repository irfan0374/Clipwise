import { Formats, LengthModes, PaymentStatuses, Plans } from "@clipwise/shared";
import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel } from "../base";

/** One per user (MVP and v1). Owns videos, usage and, in v1, billing. */
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
    // v1 billing (Stripe is the source of truth; these mirror it)
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    paymentStatus: { type: String, enum: PaymentStatuses, default: "none" },
    planRenewsAt: { type: Date, default: null },
    brandKitId: { type: Schema.Types.ObjectId, ref: "BrandKit", default: null },
    suspendedAt: { type: Date, default: null },
  },
  baseOptions,
);
WorkspaceSchema.index({ ownerUserId: 1 }, { unique: true });
// partial (not sparse): many workspaces have stripeCustomerId null
WorkspaceSchema.index(
  { stripeCustomerId: 1 },
  { unique: true, partialFilterExpression: { stripeCustomerId: { $type: "string" } } },
);

export type Workspace = InferSchemaType<typeof WorkspaceSchema>;
export const Workspace = defineModel("Workspace", WorkspaceSchema, "workspaces");

import { InviteStatuses } from "@clipwise/shared";
import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel } from "../base";

/** Sign-in is allowed only with status "invited" and revokedAt null. The waitlist form creates "waitlist" entries. */
const InviteSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    status: { type: String, enum: InviteStatuses, default: "invited" },
    invitedByUserId: { type: String, default: null }, // null for waitlist sign-ups
    note: { type: String, maxlength: 200 },
    acceptedAt: { type: Date, default: null },
    acceptedUserId: { type: String, default: null },
    revokedAt: { type: Date, default: null },
  },
  baseOptions,
);
InviteSchema.index({ email: 1 }, { unique: true });

export type Invite = InferSchemaType<typeof InviteSchema>;
export const Invite = defineModel("Invite", InviteSchema, "invites");

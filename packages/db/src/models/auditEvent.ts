import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel } from "../base";

const AuditEventSchema = new Schema(
  {
    actorUserId: { type: String, required: true },
    action: {
      type: String,
      enum: [
        "generation.pause",
        "generation.resume",
        "workspace.suspend",
        "workspace.reactivate",
        "password.reset",
        "video.retry",
      ],
      required: true,
    },
    targetId: { type: String, required: true },
    status: { type: String, enum: ["pending", "ok", "failed"], default: "pending" },
  },
  baseOptions,
);
AuditEventSchema.index({ createdAt: -1 });
AuditEventSchema.index({ targetId: 1, createdAt: -1 });
export type AuditEvent = InferSchemaType<typeof AuditEventSchema>;
export const AuditEvent = defineModel("AuditEvent", AuditEventSchema, "auditEvents");

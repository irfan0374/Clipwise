import { SocialAccountStatuses, SocialPlatforms } from "@clipwise/shared";
import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel, ownerFields } from "../base";

/** An Instagram professional account a workspace connected (Unified login), with its encrypted access key. */
const SocialAccountSchema = new Schema(
  {
    ...ownerFields,
    platform: { type: String, enum: SocialPlatforms, required: true },
    externalId: { type: String, required: true }, // Instagram account id
    username: { type: String, required: true },
    name: { type: String, default: null },
    pictureUrl: { type: String, default: null }, // Instagram CDN link; expires, refreshed on reconnect
    clientBusinessId: { type: String, default: null }, // the business portfolio Meta tied the access key to
    tokenEnc: { type: String, required: true, select: false }, // encryptSecret(); never sent to the browser
    status: { type: String, enum: SocialAccountStatuses, default: "connected" },
    statusReason: { type: String, default: null },
    connectedAt: { type: Date, default: Date.now },
    connectedByUserId: { type: String, required: true },
  },
  baseOptions,
);
SocialAccountSchema.index({ workspaceId: 1, platform: 1, externalId: 1 }, { unique: true });

export type SocialAccount = InferSchemaType<typeof SocialAccountSchema>;
export const SocialAccount = defineModel("SocialAccount", SocialAccountSchema, "socialAccounts");

import { SocialPostStatuses } from "@clipwise/shared";
import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel, ownerFields } from "../base";

/** One Reel sent (or to be sent) to an Instagram account: a final render plus its caption. */
const SocialPostSchema = new Schema(
  {
    ...ownerFields,
    videoId: { type: Schema.Types.ObjectId, ref: "Video", required: true },
    renderId: { type: Schema.Types.ObjectId, ref: "Render", required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "SocialAccount", required: true },
    username: { type: String, required: true }, // kept for history after the account is disconnected
    caption: { type: String, default: "", maxlength: 2200 },
    publishAt: { type: Date, required: true },
    status: { type: String, enum: SocialPostStatuses, default: "queued" },
    attempt: { type: Number, default: 1 }, // the publish job's attempt number ("Try again" adds one)
    containerId: { type: String, default: null }, // Instagram's upload container (reused if the job retries)
    mediaId: { type: String, default: null },
    permalink: { type: String, default: null },
    postedAt: { type: Date, default: null },
    postedLate: { type: Boolean, default: false }, // the worker was offline at publishAt
    error: { type: String, default: null }, // user-safe reason
    createdByUserId: { type: String, required: true },
  },
  baseOptions,
);
SocialPostSchema.index({ videoId: 1, createdAt: -1 });
SocialPostSchema.index({ workspaceId: 1, publishAt: 1 }); // calendar (Step J2)
SocialPostSchema.index({ status: 1, publishAt: 1 }); // the worker finds due posts after being offline

export type SocialPost = InferSchemaType<typeof SocialPostSchema>;
export const SocialPost = defineModel("SocialPost", SocialPostSchema, "socialPosts");

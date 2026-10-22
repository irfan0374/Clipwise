import { ScriptSources } from "@clipwise/shared";
import { type InferSchemaType, Schema } from "mongoose";
import { baseOptions, defineModel, ownerFields } from "../base";
import { ScriptSchema } from "./video.parts";

/** A snapshot every time the script changes, for undo and support. */
const ScriptVersionSchema = new Schema(
  {
    ...ownerFields,
    videoId: { type: Schema.Types.ObjectId, ref: "Video", required: true },
    version: { type: Number, required: true },
    source: { type: String, enum: ScriptSources, required: true },
    script: { type: ScriptSchema, required: true },
    changedScenes: [Number], // empty for full generations
    model: String, // Gemini model that wrote it, if any
    createdByUserId: { type: String, default: null },
  },
  baseOptions,
);
ScriptVersionSchema.index({ videoId: 1, version: -1 }, { unique: true });

export type ScriptVersion = InferSchemaType<typeof ScriptVersionSchema>;
export const ScriptVersion = defineModel("ScriptVersion", ScriptVersionSchema, "scriptVersions");

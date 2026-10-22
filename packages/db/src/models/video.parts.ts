import { ClaimVerdicts, LengthSeconds } from "@clipwise/shared";
import { ParticleMotions, VisualColors, VisualTypes } from "@clipwise/video";
import { Schema } from "mongoose";

// Mirrors the pipeline's Zod ScriptSchema, so the worker's output is saved as-is.
export const Templates = ["title", "bullets", "stat", "imageFocus"] as const;

const VisualItemSchema = new Schema(
  {
    icon: String,
    label: { type: String, maxlength: 18 },
    value: Number,
    color: { type: String, enum: VisualColors },
  },
  { _id: false },
);

const VisualSchema = new Schema(
  {
    type: { type: String, enum: VisualTypes, required: true },
    icon: String,
    items: { type: [VisualItemSchema], default: undefined },
    motion: { type: String, enum: ParticleMotions },
    color: { type: String, enum: VisualColors },
  },
  { _id: false },
);

const SceneSchema = new Schema(
  {
    index: { type: Number, required: true, min: 0 },
    role: { type: String, maxlength: 24 }, // storyboard label: Hook, Feature, Proof, Offer, Outro…
    narration: { type: String, required: true, maxlength: 400 },
    template: { type: String, enum: Templates, required: true },
    onScreenText: {
      type: [String],
      validate: { validator: (v: string[]) => v.length >= 1 && v.length <= 3, message: "1–3 lines of on-screen text" },
    },
    stat: { type: new Schema({ value: String, label: String }, { _id: false }), default: undefined },
    visual: { type: VisualSchema, default: undefined },
    imageQuery: String,
  },
  { _id: false },
);

export const ScriptSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 60 },
    lengthSeconds: { type: Number, enum: LengthSeconds, required: true },
    hook: { type: String, required: true },
    cta: { type: String, required: true },
    scenes: {
      type: [SceneSchema],
      validate: { validator: (v: unknown[]) => v.length >= 3 && v.length <= 10, message: "3–10 scenes" },
    },
  },
  { _id: false },
);

export const ClaimSchema = new Schema(
  {
    scene: Number,
    text: String,
    verdict: { type: String, enum: ClaimVerdicts },
    fix: String,
    acceptedAt: { type: Date, default: null }, // "Mark as OK" on the storyboard / editor
  },
  { _id: false },
);

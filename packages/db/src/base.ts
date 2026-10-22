import { model, Schema, type SchemaOptions } from "mongoose";

export const baseOptions = {
  timestamps: true,
  versionKey: false,
  minimize: false,
  strict: true,
} satisfies SchemaOptions;

/** Every Clipwise document belongs to a workspace; every query filters on it. */
export const ownerFields = {
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
};

/** Next.js hot reloads re-import model files; overwriteModels avoids OverwriteModelError. */
export const defineModel = <TSchema extends Schema>(name: string, schema: TSchema, collection: string) =>
  model(name, schema, collection, { overwriteModels: true });

import path from "node:path";
import { fileURLToPath } from "node:url";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
import type { Storage } from "./types";

export { keys } from "./keys";
export { LocalStorage } from "./local";
export { type S3Config, S3Storage } from "./s3";
export { assertSafeKey, contentTypeFor, type PutOptions, type SignedUrlOptions, type Storage } from "./types";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env (see .env.example)`);
  return value;
};

let instance: Storage | undefined;

/**
 * The configured storage. STORAGE_DRIVER=local (default) keeps files in .storage/ at the repo root;
 * STORAGE_DRIVER=s3 uses the S3_* settings (R2, B2…). Switching needs no code changes.
 */
export const storage = (): Storage => {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "s3") {
    instance = new S3Storage({
      endpoint: required("S3_ENDPOINT"),
      region: process.env.S3_REGION ?? "auto",
      bucket: required("S3_BUCKET"),
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    });
  } else if (driver === "local") {
    instance = new LocalStorage(
      path.resolve(repoRoot, process.env.STORAGE_LOCAL_DIR ?? ".storage"),
      required("BETTER_AUTH_SECRET"), // signs local file URLs
      process.env.APP_URL ?? "http://localhost:3000",
    );
  } else {
    throw new Error(`Unknown STORAGE_DRIVER "${driver}" (use local or s3)`);
  }
  return instance;
};

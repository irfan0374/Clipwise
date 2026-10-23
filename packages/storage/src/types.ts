export type PutOptions = { contentType?: string };

export type SignedUrlOptions = {
  /** Seconds the link stays valid (default 1 hour). */
  expiresIn?: number;
  /** Ask the browser to download instead of play, with this file name. */
  downloadName?: string;
};

/** Object storage, the same for a local folder (dev) and an S3-compatible bucket (R2, B2…). */
export interface Storage {
  readonly driver: "local" | "s3";
  put(key: string, body: Buffer | string, options?: PutOptions): Promise<void>;
  /** Uploads a file from disk (streams it; fine for MP4s). */
  putFile(key: string, filePath: string, options?: PutOptions): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Downloads to a file on disk (the worker needs local files to render). */
  getToFile(key: string, filePath: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  size(key: string): Promise<number | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
  signedUrl(key: string, options?: SignedUrlOptions): Promise<string>;
}

export const contentTypeFor = (key: string) =>
  key.endsWith(".mp4")
    ? "video/mp4"
    : key.endsWith(".mp3")
      ? "audio/mpeg"
      : key.endsWith(".json")
        ? "application/json"
        : key.endsWith(".jpg")
          ? "image/jpeg"
          : "application/octet-stream";

/** Keys never contain "..", a leading "/" or backslashes, so a local key can't escape the storage folder. */
export const assertSafeKey = (key: string) => {
  if (!key || key.startsWith("/") || key.includes("..") || key.includes("\\") || key.includes("\0")) {
    throw new Error(`Unsafe storage key: ${JSON.stringify(key)}`);
  }
};

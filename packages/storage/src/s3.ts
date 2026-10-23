import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertSafeKey, contentTypeFor, type PutOptions, type SignedUrlOptions, type Storage } from "./types";

export type S3Config = {
  endpoint: string; // e.g. https://<account>.r2.cloudflarestorage.com or https://s3.<region>.backblazeb2.com
  region: string; // "auto" for R2
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/** Any S3-compatible bucket (Cloudflare R2, Backblaze B2, AWS S3). The bucket stays private. */
export class S3Storage implements Storage {
  readonly driver = "s3" as const;
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: true,
    });
  }

  async put(key: string, body: Buffer | string, options?: PutOptions) {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: options?.contentType ?? contentTypeFor(key),
      }),
    );
  }

  async putFile(key: string, filePath: string, options?: PutOptions) {
    assertSafeKey(key);
    const { size } = await import("node:fs/promises").then((fs) => fs.stat(filePath));
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentLength: size,
        ContentType: options?.contentType ?? contentTypeFor(key),
      }),
    );
  }

  private async body(key: string) {
    assertSafeKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
    if (!res.Body) throw new Error(`Empty object: ${key}`);
    return res.Body as Readable;
  }

  async get(key: string) {
    const chunks: Buffer[] = [];
    for await (const chunk of await this.body(key)) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async getToFile(key: string, filePath: string) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await pipeline(await this.body(key), createWriteStream(filePath));
  }

  async size(key: string) {
    assertSafeKey(key);
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return head.ContentLength ?? 0;
    } catch (error) {
      if ((error as { name?: string }).name === "NotFound") return null;
      throw error;
    }
  }

  async exists(key: string) {
    return (await this.size(key)) !== null;
  }

  async delete(key: string) {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  async deletePrefix(prefix: string) {
    assertSafeKey(prefix);
    let deleted = 0;
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.config.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const objects = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
      if (objects.length) {
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.config.bucket, Delete: { Objects: objects } }));
        deleted += objects.length;
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return deleted;
  }

  signedUrl(key: string, { expiresIn = 3600, downloadName }: SignedUrlOptions = {}) {
    assertSafeKey(key);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ResponseContentDisposition: downloadName
          ? `attachment; filename="${downloadName.replace(/"/g, "")}"`
          : undefined,
      }),
      { expiresIn },
    );
  }
}

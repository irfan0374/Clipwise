import { createHmac, timingSafeEqual } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSafeKey, type PutOptions, type SignedUrlOptions, type Storage } from "./types";

/**
 * Dev storage: files in a local folder. Signed URLs point at the web app's /api/files route, which
 * checks the HMAC signature and expiry before streaming the file (same behaviour as a bucket's signed URL).
 */
export class LocalStorage implements Storage {
  readonly driver = "local" as const;

  constructor(
    private readonly root: string,
    private readonly secret: string,
    private readonly baseUrl: string,
  ) {}

  private file(key: string) {
    assertSafeKey(key);
    return path.join(this.root, key);
  }

  async put(key: string, body: Buffer | string, _options?: PutOptions) {
    const file = this.file(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async putFile(key: string, filePath: string, _options?: PutOptions) {
    const file = this.file(key);
    await mkdir(path.dirname(file), { recursive: true });
    await copyFile(filePath, file);
  }

  get(key: string) {
    return readFile(this.file(key));
  }

  async getToFile(key: string, filePath: string) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await copyFile(this.file(key), filePath);
  }

  async exists(key: string) {
    return (await this.size(key)) !== null;
  }

  async size(key: string) {
    try {
      return (await stat(this.file(key))).size;
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await rm(this.file(key), { force: true });
  }

  async deletePrefix(prefix: string) {
    assertSafeKey(prefix);
    const dir = path.join(this.root, prefix);
    const count = await readdir(dir, { recursive: true }).then(
      (entries) => entries.length,
      () => 0,
    );
    await rm(dir, { recursive: true, force: true });
    return count;
  }

  /** Path of the signature, shared with verify(). */
  private sign(key: string, exp: number, downloadName = "") {
    return createHmac("sha256", this.secret).update(`${key}\n${exp}\n${downloadName}`).digest("base64url");
  }

  async signedUrl(key: string, { expiresIn = 3600, downloadName }: SignedUrlOptions = {}) {
    assertSafeKey(key);
    const exp = Math.floor(Date.now() / 1000) + expiresIn;
    const params = new URLSearchParams({ exp: String(exp), sig: this.sign(key, exp, downloadName) });
    if (downloadName) params.set("dl", downloadName);
    return `${this.baseUrl}/api/files/${key.split("/").map(encodeURIComponent).join("/")}?${params}`;
  }

  /** For the /api/files route: is this signed request valid and unexpired? Returns the file path if so. */
  verify(key: string, query: { exp?: string | null; sig?: string | null; dl?: string | null }): string | null {
    try {
      assertSafeKey(key);
    } catch {
      return null;
    }
    const exp = Number(query.exp);
    if (!query.sig || !Number.isFinite(exp) || exp < Date.now() / 1000) return null;
    const expected = Buffer.from(this.sign(key, exp, query.dl ?? ""));
    const given = Buffer.from(query.sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    return this.file(key);
  }
}

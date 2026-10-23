import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keys, LocalStorage } from "../src/index";

let dir: string;
let store: LocalStorage;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "clipwise-storage-"));
  store = new LocalStorage(dir, "test-secret", "http://localhost:3000");
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const query = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("local storage", () => {
  it("puts, reads, sizes and deletes objects", async () => {
    const key = keys.alignment("w1", "v1", 1);
    await store.put(key, '{"ok":true}');
    expect((await store.get(key)).toString()).toBe('{"ok":true}');
    expect(await store.size(key)).toBe(11);
    await store.delete(key);
    expect(await store.exists(key)).toBe(false);
  });

  it("copies files in and out", async () => {
    const src = path.join(dir, "in.mp4");
    await writeFile(src, "fake video");
    const key = keys.render("w1", "v1", "r1");
    await store.putFile(key, src);
    const out = path.join(dir, "out", "copy.mp4");
    await store.getToFile(key, out);
    expect(await readFile(out, "utf8")).toBe("fake video");
  });

  it("deletes everything under a video", async () => {
    await store.put(keys.voice("w1", "v2", 1), "a");
    await store.put(keys.render("w1", "v2", "r9"), "b");
    expect(await store.deletePrefix(keys.videoPrefix("w1", "v2"))).toBeGreaterThanOrEqual(2);
    expect(await store.exists(keys.voice("w1", "v2", 1))).toBe(false);
  });

  it("refuses keys that try to leave the storage folder", async () => {
    await expect(store.put("../escape.txt", "x")).rejects.toThrow(/Unsafe/);
    await expect(store.put("/etc/passwd", "x")).rejects.toThrow(/Unsafe/);
  });

  it("signs URLs that verify, and rejects tampering and expiry", async () => {
    const key = keys.render("w1", "v1", "r1");
    const url = await store.signedUrl(key, { downloadName: "my video.mp4" });
    expect(url).toMatch(/^http:\/\/localhost:3000\/api\/files\/ws\/w1\/videos\/v1\/renders\/r1\.mp4\?/);
    const q = query(url);
    expect(store.verify(key, q)).toBe(path.join(dir, key));
    expect(store.verify(keys.render("w1", "v1", "OTHER"), q)).toBeNull(); // signature is per key
    expect(store.verify(key, { ...q, dl: "other.mp4" })).toBeNull(); // and per download name
    expect(store.verify(key, { ...q, exp: String(Number(q.exp) + 60) })).toBeNull(); // can't extend expiry
    const expired = await store.signedUrl(key, { expiresIn: -1 });
    expect(store.verify(key, query(expired))).toBeNull();
  });
});

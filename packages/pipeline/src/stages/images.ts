import { createHash } from "node:crypto";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env, repoRoot } from "../env";
import { withRetry } from "../retry";
import type { Script } from "../types";

const cacheDir = path.join(repoRoot, "out/.cache/images");

type Photo = { id: string; downloadUrl: string; photographer: string; pageUrl: string };

type ImageProvider = { name: "pexels" | "pixabay"; search: (query: string, portrait: boolean) => Promise<Photo | undefined> };

const getJson = async <T>(url: URL, headers: Record<string, string> = {}, label: string): Promise<T> => {
  const { value } = await withRetry(
    async () => {
      const res = await fetch(url, { headers });
      if (!res.ok) throw Object.assign(new Error(`${label} ${res.status}`), { status: res.status });
      return (await res.json()) as T;
    },
    { label },
  );
  return value;
};

const pexels = (apiKey: string): ImageProvider => ({
  name: "pexels",
  search: async (query, portrait) => {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "5");
    if (portrait) url.searchParams.set("orientation", "portrait");
    const data = await getJson<{ photos: { id: number; photographer: string; url: string; src: { original: string } }[] }>(url, { Authorization: apiKey }, "Pexels");
    const photo = data.photos[0];
    // Pexels crops server-side to the exact 9:16 frame.
    return photo && { id: `pexels-${photo.id}`, downloadUrl: `${photo.src.original}?auto=compress&cs=tinysrgb&fit=crop&w=1080&h=1920`, photographer: photo.photographer, pageUrl: photo.url };
  },
});

const pixabay = (apiKey: string): ImageProvider => ({
  name: "pixabay",
  search: async (query, portrait) => {
    const url = new URL("https://pixabay.com/api/");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", query);
    url.searchParams.set("image_type", "photo");
    url.searchParams.set("safesearch", "true");
    url.searchParams.set("per_page", "5");
    if (portrait) url.searchParams.set("orientation", "vertical");
    const data = await getJson<{ hits: { id: number; user: string; pageURL: string; largeImageURL: string }[] }>(url, {}, "Pixabay");
    const hit = data.hits[0];
    // Pixabay doesn't crop; the ImageFocus template covers the 9:16 frame with object-fit.
    return hit && { id: `pixabay-${hit.id}`, downloadUrl: hit.largeImageURL, photographer: hit.user, pageUrl: hit.pageURL };
  },
});

/** Pexels if its key is set, else Pixabay, else none (videos then skip photo scenes). */
export const imageProvider = (): ImageProvider | null => {
  const keys = env.imageKeys();
  if (keys.pexels) return pexels(keys.pexels);
  if (keys.pixabay) return pixabay(keys.pixabay);
  return null;
};

const exists = (file: string) => stat(file).then(() => true, () => false);

export type SceneImage = { sceneIndex: number; file: string; query: string; photographer: string; pageUrl: string; provider: string };
export type ImagesResult = { images: SceneImage[]; missing: number[]; requests: number; provider: string | null };

/**
 * Finds and downloads one photo per imageFocus scene into `mediaDir`.
 * Tries the query, then its first two words, then any orientation. Scenes with no match are reported as missing.
 */
export const fetchImages = async (script: Script, mediaDir: string): Promise<ImagesResult> => {
  const provider = imageProvider();
  const scenes = script.scenes.filter((s) => s.template === "imageFocus" && s.imageQuery);
  if (!provider) return { images: [], missing: scenes.map((s) => s.index), requests: 0, provider: null };

  await mkdir(cacheDir, { recursive: true });
  let requests = 0;

  const results = await Promise.all(
    scenes.map(async (scene): Promise<SceneImage | number> => {
      const query = scene.imageQuery!.trim();
      const short = query.split(/\s+/).slice(0, 2).join(" ");
      const attempts: [string, boolean][] = [[query, true], [short, true], [query, false]];

      for (const [q, portrait] of attempts) {
        requests++;
        const photo = await provider.search(q, portrait);
        if (!photo) continue;

        const key = createHash("sha1").update(photo.id).digest("hex").slice(0, 12);
        const cached = path.join(cacheDir, `${key}.jpg`);
        if (!(await exists(cached))) {
          const res = await fetch(photo.downloadUrl);
          if (!res.ok) throw new Error(`${provider.name} image download failed (${res.status})`);
          await writeFile(cached, Buffer.from(await res.arrayBuffer()));
        }
        const file = `scene-${scene.index}.jpg`;
        await copyFile(cached, path.join(mediaDir, file));
        return { sceneIndex: scene.index, file, query: q, photographer: photo.photographer, pageUrl: photo.pageUrl, provider: provider.name } satisfies SceneImage;
      }
      return scene.index;
    }),
  );

  return {
    images: results.filter((r): r is SceneImage => typeof r !== "number"),
    missing: results.filter((r): r is number => typeof r === "number"),
    requests,
    provider: provider.name,
  };
};

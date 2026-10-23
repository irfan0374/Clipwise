import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { contentTypeFor, LocalStorage, storage } from "@clipwise/storage";

export const dynamic = "force-dynamic";

/**
 * Serves files from local storage (dev) for signed URLs: the signature and expiry are checked, so links behave
 * like a private bucket's signed URLs. Supports byte ranges so videos can be scrubbed. In production files come
 * straight from the bucket and this route returns 404.
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const store = storage();
  if (!(store instanceof LocalStorage)) return new Response("Not found", { status: 404 });
  const key = (await params).key.map(decodeURIComponent).join("/");
  const q = new URL(request.url).searchParams;
  const file = store.verify(key, { exp: q.get("exp"), sig: q.get("sig"), dl: q.get("dl") });
  if (!file) return new Response("Link expired or invalid", { status: 403 });

  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": contentTypeFor(key),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  const dl = q.get("dl");
  if (dl) headers["Content-Disposition"] = `attachment; filename="${dl.replace(/["\r\n]/g, "")}"`;

  const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get("range") ?? "");
  if (range && size > 0) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, { headers: { ...headers, "Content-Length": String(size) } });
}

import { connectDb, Video } from "@clipwise/db";
import { subscribeVideoEvents } from "@clipwise/queue";
import type { VideoEvent } from "@clipwise/shared";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
// Hosting platforms end long requests (Vercel: 300 s on the free plan). The stream closes itself a little before
// that and the browser's EventSource reconnects at once, receiving the current status again.
export const maxDuration = 300;
const STREAM_MS = 270_000;

/**
 * Live progress for one video (server-sent events). Owner only. Sends the current status first, so a page that
 * (re)connects never misses state, then relays the worker's events; a comment every 15 s keeps proxies open.
 */
export async function GET(request: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.suspendedAt) return new Response("Account suspended", { status: 403 });
  if (!/^[a-f0-9]{24}$/.test(videoId)) return new Response("Not found", { status: 404 });
  await connectDb();
  const { Workspace } = await import("@clipwise/db");
  const ws = await Workspace.findOne({ ownerUserId: session.user.id }, { _id: 1 }).lean();
  const owned = ws ? await Video.exists({ _id: videoId, workspaceId: ws._id, deletedAt: null }) : null;
  if (!owned) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let stop: (() => Promise<void>) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;
  let end: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  // Safe to call at any point, including while start() is still subscribing: whatever has been set up so far is
  // undone, and the rest of start() stops instead of setting up more.
  const cleanUp = () => {
    closed = true;
    clearInterval(ping);
    clearTimeout(end);
    void stop?.();
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = () => {
        cleanUp();
        try {
          controller.close();
        } catch {}
      };
      // Listen for the browser leaving before anything async, so a tab closed mid-setup is still cleaned up.
      request.signal.addEventListener("abort", close, { once: true });
      if (request.signal.aborted) return close();
      const send = (event: VideoEvent) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };
      controller.enqueue(encoder.encode("retry: 2000\n\n")); // reconnect after 2 s
      // Subscribe FIRST, then read the snapshot: an event published in between is delivered, not lost.
      const unsubscribe = await subscribeVideoEvents(videoId, send);
      if (closed) return void unsubscribe(); // the browser left while we were subscribing
      stop = unsubscribe;
      const video = await Video.findById(videoId, { status: 1, stage: 1, progress: 1 }).lean();
      if (closed) return;
      if (video) {
        send({
          type: "status",
          status: video.status,
          stage: (video.stage ?? null) as never,
          progress: video.progress ?? 0,
        });
      }
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {}
      }, 15_000);
      end = setTimeout(close, STREAM_MS);
    },
    cancel: cleanUp,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

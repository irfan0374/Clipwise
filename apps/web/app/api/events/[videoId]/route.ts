import { connectDb, Video } from "@clipwise/db";
import { subscribeVideoEvents } from "@clipwise/queue";
import type { VideoEvent } from "@clipwise/shared";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Live progress for one video (server-sent events). Owner only. Sends the current status first, so a page that
 * (re)connects never misses state, then relays the worker's events; a comment every 15 s keeps proxies open.
 */
export async function GET(request: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!/^[a-f0-9]{24}$/.test(videoId)) return new Response("Not found", { status: 404 });
  await connectDb();
  const { Workspace } = await import("@clipwise/db");
  const ws = await Workspace.findOne({ ownerUserId: session.user.id }, { _id: 1 }).lean();
  const owned = ws ? await Video.exists({ _id: videoId, workspaceId: ws._id, deletedAt: null }) : null;
  if (!owned) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let stop: (() => Promise<void>) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: VideoEvent) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };
      // Subscribe FIRST, then read the snapshot: an event published in between is delivered, not lost.
      stop = await subscribeVideoEvents(videoId, send);
      const video = await Video.findById(videoId, { status: 1, stage: 1, progress: 1 }).lean();
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
      request.signal.addEventListener("abort", () => {
        clearInterval(ping);
        void stop?.();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      clearInterval(ping);
      void stop?.();
    },
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

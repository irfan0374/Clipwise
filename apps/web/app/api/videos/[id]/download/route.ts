import { connectDb, Render, Video, Workspace } from "@clipwise/db";
import { storage } from "@clipwise/storage";
import { downloadName } from "@/lib/library-query";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.suspendedAt) return new Response("Account suspended", { status: 403 });
  const { id } = await params;
  const renderId = new URL(request.url).searchParams.get("renderId");
  if (!/^[a-f0-9]{24}$/.test(id) || (renderId && !/^[a-f0-9]{24}$/.test(renderId)))
    return new Response("Not found", { status: 404 });
  await connectDb();
  const ws = await Workspace.findOne({ ownerUserId: session.user.id }, { _id: 1 }).lean();
  if (!ws) return new Response("Not found", { status: 404 });
  const video = await Video.findOne({ _id: id, workspaceId: ws._id, deletedAt: null }).lean();
  if (!video) return new Response("Not found", { status: 404 });
  const render = await Render.findOne({
    ...(renderId ? { _id: renderId } : {}),
    videoId: video._id,
    workspaceId: ws._id,
    kind: "final",
    status: "done",
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!render?.r2Key || !(await storage().exists(render.r2Key)))
    return new Response("The video file isn't available. Open the project to check its status.", { status: 404 });
  const location = await storage().signedUrl(render.r2Key, {
    expiresIn: 3600,
    downloadName: downloadName(video.title || video.topic),
  });
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "private, no-store" } });
}

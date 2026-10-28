import { workerStatus } from "@clipwise/queue";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Whether the worker (which writes, voices and renders videos) is running. Signed-in users only. */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { online, lastSeen } = await workerStatus();
  return Response.json({ online, lastSeen }, { headers: { "Cache-Control": "no-store" } });
}

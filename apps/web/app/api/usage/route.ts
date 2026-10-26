import { dailyUsage } from "@clipwise/queue";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Today's usage for the signed-in user (sidebar meter). */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.suspendedAt) return new Response("Account suspended", { status: 403 });
  const usage = await dailyUsage(session.user.id);
  return Response.json(usage, { headers: { "Cache-Control": "no-store" } });
}

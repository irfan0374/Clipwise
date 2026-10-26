import { Voices } from "@clipwise/shared";
import { getSession } from "@/lib/session";

// ElevenLabs publishes a short sample clip for each default voice; fetching it costs no credits.
const cache = new Map<string, string>();

/** Redirects to the voice's sample clip (only the allowed beta voices). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.suspendedAt) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  if (!Voices.some((v) => v.id === id)) return new Response("Not found", { status: 404 });
  let url = cache.get(id);
  if (!url) {
    const res = await fetch(`https://api.elevenlabs.io/v1/voices/${id}`, {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" },
    });
    const data = (await res.json().catch(() => null)) as { preview_url?: string } | null;
    if (!res.ok || !data?.preview_url) return new Response("Sample unavailable", { status: 502 });
    url = data.preview_url;
    cache.set(id, url);
  }
  return Response.redirect(url, 302);
}

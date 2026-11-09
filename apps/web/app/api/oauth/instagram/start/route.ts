import { randomBytes } from "node:crypto";
import { instagramLoginUrl, missingInstagramSettings } from "@clipwise/queue";
import { NextResponse } from "next/server";
import { connectionsUrl, instagramRedirectUri, STATE_COOKIE, STATE_COOKIE_PATH } from "@/lib/instagram";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** "Connect Instagram": sends the signed-in user to Meta's login with a one-time state. `?popup=1` when Clipwise
 * opened it in a small window (computers), so the callback can hand the result back and close it. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));
  if (session.user.suspendedAt) return NextResponse.redirect(new URL("/suspended", request.url));
  const missing = missingInstagramSettings();
  if (missing.length) {
    console.error(`[instagram] connect is not set up: missing ${missing.join(", ")}`);
    return NextResponse.redirect(connectionsUrl(request.url, { error: "setup" }));
  }
  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(instagramLoginUrl(instagramRedirectUri(request.url), state));
  const mode = new URL(request.url).searchParams.get("popup") === "1" ? "popup" : "page";
  response.cookies.set(STATE_COOKIE, `${state}.${session.user.id}.${mode}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax", // sent on Meta's top-level redirect back to us
    path: STATE_COOKIE_PATH,
    maxAge: 15 * 60,
  });
  return response;
}

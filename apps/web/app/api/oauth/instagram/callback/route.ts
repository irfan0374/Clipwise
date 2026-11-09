import { timingSafeEqual } from "node:crypto";
import { connectDb, encryptSecret, SocialAccount, Workspace } from "@clipwise/db";
import { connectWithCode, InstagramError } from "@clipwise/queue";
import { type NextRequest, NextResponse } from "next/server";
import { connectionsUrl, instagramRedirectUri, STATE_COOKIE, STATE_COOKIE_PATH } from "@/lib/instagram";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const sameText = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Meta sends people back here after Instagram login: save the shared accounts, then show Settings → Connections. */
export async function GET(request: NextRequest) {
  const [state, stateUser, mode] = (request.cookies.get(STATE_COOKIE)?.value ?? "").split(".");
  const done = (result: Record<string, string>) => {
    const response = NextResponse.redirect(
      connectionsUrl(request.url, mode === "popup" ? { ...result, popup: "1" } : result),
    );
    response.cookies.set(STATE_COOKIE, "", { path: STATE_COOKIE_PATH, maxAge: 0 });
    return response;
  };
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));
  if (session.user.suspendedAt) return NextResponse.redirect(new URL("/suspended", request.url));

  const params = request.nextUrl.searchParams;
  if (!state || stateUser !== session.user.id || !sameText(state, params.get("state") ?? ""))
    return done({ error: "state" });
  if (params.get("error")) return done({ error: "denied" }); // "Cancel" on Meta's page
  const code = params.get("code");
  if (!code) return done({ error: "unknown" });

  try {
    const result = await connectWithCode(code, instagramRedirectUri(request.url));
    await connectDb();
    const workspace = await Workspace.findOne({ ownerUserId: session.user.id }, { _id: 1 }).lean();
    if (!workspace) return done({ error: "unknown" });
    const tokenEnc = encryptSecret(result.accessToken);
    for (const account of result.accounts) {
      await SocialAccount.updateOne(
        { workspaceId: workspace._id, platform: "instagram", externalId: account.id },
        {
          $set: {
            username: account.username,
            name: account.name,
            pictureUrl: account.pictureUrl,
            clientBusinessId: result.clientBusinessId,
            tokenEnc,
            status: "connected",
            statusReason: null,
            connectedAt: new Date(),
            connectedByUserId: session.user.id,
          },
        },
        { upsert: true, runValidators: true },
      );
    }
    return done({ connected: String(result.accounts.length) });
  } catch (error) {
    if (error instanceof InstagramError) {
      console.error("[instagram] connect failed:", error.kind, error.detail ?? error.message);
      return done({ error: error.kind });
    }
    console.error("[instagram] connect failed:", error);
    return done({ error: "unknown" });
  }
}

// Instagram through Meta's "Instagram API with Unified login": the person logs in with Instagram (or Facebook), picks
// the professional account to share, and Meta returns a code. The code becomes a Business Integration System User
// access key (never expires with our configuration), and every call goes to graph.facebook.com with the account id.
// No Facebook Page is involved. Docs: developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login

export const instagramSettings = () => ({
  appId: process.env.META_APP_ID ?? "",
  appSecret: process.env.META_APP_SECRET ?? "",
  configId: process.env.META_LOGIN_CONFIG_ID ?? "",
  version: process.env.META_GRAPH_VERSION || "v27.0",
});

/** Names of the Instagram settings that are missing (empty = Connect can be offered). */
export const missingInstagramSettings = () => {
  const s = instagramSettings();
  return [
    !s.appId && "META_APP_ID",
    !s.appSecret && "META_APP_SECRET",
    !s.configId && "META_LOGIN_CONFIG_ID",
    !process.env.TOKEN_ENCRYPTION_KEY && "TOKEN_ENCRYPTION_KEY",
  ].filter((n): n is string => Boolean(n));
};

/** Meta's login page for our configuration; it returns to `redirectUri` with `code` and our `state`. */
export function instagramLoginUrl(redirectUri: string, state: string) {
  const s = instagramSettings();
  const params = new URLSearchParams({
    client_id: s.appId,
    config_id: s.configId,
    redirect_uri: redirectUri,
    response_type: "code",
    // As in Meta's own login URL for this configuration: always offer "Continue with Instagram", even when the
    // browser is already logged into Facebook (otherwise Meta jumps to the Facebook business-portfolio screen).
    override_default_response_type: "true",
    prompt: "login",
    state,
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

/** A Graph API error, with a message that is safe to show. */
export class InstagramError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "account" | "denied" | "temporary" | "unknown",
    readonly detail?: string,
  ) {
    super(message);
  }
}

type GraphErrorBody = { error?: { message?: string; code?: number; error_subcode?: number; type?: string } };
type Fetch = typeof fetch;

/** Turns a Graph API error into a short, user-safe message (the raw one stays in `detail` for logs). */
export function graphError(status: number, body: GraphErrorBody) {
  const e = body.error ?? {};
  const detail = `${status} ${e.type ?? ""} #${e.code ?? "?"}/${e.error_subcode ?? "-"}: ${e.message ?? "no message"}`;
  if (e.code === 190 || e.code === 102 || status === 401)
    return new InstagramError("Instagram access stopped working. Connect the account again.", "auth", detail);
  if (e.code === 10 && /business or creator/i.test(e.message ?? ""))
    return new InstagramError(
      "This Instagram account is personal. Switch it to a Creator or Business account in the Instagram app, then connect again.",
      "account",
      detail,
    );
  if (e.code === 4 || e.code === 17 || e.code === 32 || e.code === 613 || status >= 500)
    return new InstagramError("Instagram is busy right now. Try again in a few minutes.", "temporary", detail);
  return new InstagramError(
    "Instagram refused the request. Try again, or connect the account again.",
    "unknown",
    detail,
  );
}

async function graph<T>(
  path: string,
  params: Record<string, string>,
  fetcher: Fetch = fetch,
  method: "GET" | "POST" = "GET",
): Promise<T> {
  const base = `https://graph.facebook.com/${instagramSettings().version}/${path}`;
  const query = new URLSearchParams(params);
  let res: Response;
  try {
    // POST sends the parameters (and the access key) in the body, so they never appear in URLs or logs.
    res =
      method === "POST"
        ? await fetcher(base, { method, body: query, cache: "no-store", signal: AbortSignal.timeout(30_000) })
        : await fetcher(`${base}?${query}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new InstagramError("Couldn't reach Instagram. Try again.", "temporary", (err as Error).message);
  }
  const body = (await res.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!res.ok || body.error) throw graphError(res.status, body);
  return body;
}

export type InstagramAccount = { id: string; username: string; name: string | null; pictureUrl: string | null };

/**
 * After Meta redirects back: swaps the code for the access key and reads the accounts the person shared.
 * Throws InstagramError (kind "account" when no professional account was shared).
 */
export async function connectWithCode(code: string, redirectUri: string, fetcher: Fetch = fetch) {
  const s = instagramSettings();
  const token = await graph<{ access_token?: string }>(
    "oauth/access_token",
    { client_id: s.appId, client_secret: s.appSecret, redirect_uri: redirectUri, code },
    fetcher,
  );
  if (!token.access_token) throw new InstagramError("Instagram didn't return access. Try again.", "unknown");
  const accessToken = token.access_token;
  const [me, assigned] = await Promise.all([
    graph<{ client_business_id?: string }>("me", { fields: "client_business_id", access_token: accessToken }, fetcher),
    graph<{ data?: { id: string; username?: string }[] }>(
      "me/assigned_instagram_accounts",
      { fields: "id,username", access_token: accessToken },
      fetcher,
    ),
  ]);
  if (!assigned.data?.length)
    throw new InstagramError(
      "No Instagram account was shared. Connect again and choose your Creator or Business account.",
      "account",
    );
  const accounts = await Promise.all(
    assigned.data.map(async (a): Promise<InstagramAccount> => {
      // Name and photo are nice to have: the account still connects if Meta doesn't return them.
      const profile = await graph<{ username?: string; name?: string; profile_picture_url?: string }>(
        a.id,
        { fields: "username,name,profile_picture_url", access_token: accessToken },
        fetcher,
      ).catch(() => ({}) as { username?: string; name?: string; profile_picture_url?: string });
      return {
        id: a.id,
        username: profile.username ?? a.username ?? a.id,
        name: profile.name ?? null,
        pictureUrl: profile.profile_picture_url ?? null,
      };
    }),
  );
  return { accessToken, clientBusinessId: me.client_business_id ?? null, accounts };
}

// ─── Publishing a Reel ─────────────────────────────────────────────────────────────────────────────────────────
// Instagram downloads the MP4 from a link (our signed R2 URL), processes it into an upload "container", and only
// then publishes it. One container can be published once, so a retried job reuses the saved container id.

/** Starts the upload: Instagram fetches `videoUrl` itself. Returns the container id. */
export async function createReelContainer(
  accountId: string,
  accessToken: string,
  input: { videoUrl: string; caption: string },
  fetcher: Fetch = fetch,
) {
  const res = await graph<{ id?: string }>(
    `${accountId}/media`,
    {
      media_type: "REELS",
      video_url: input.videoUrl,
      caption: input.caption,
      share_to_feed: "true",
      access_token: accessToken,
    },
    fetcher,
    "POST",
  );
  if (!res.id) throw new InstagramError("Instagram didn't accept the video. Try again.", "unknown");
  return res.id;
}

export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "PUBLISHED" | "ERROR" | "EXPIRED";

/** Where Instagram is with processing the uploaded video. */
export async function containerStatus(containerId: string, accessToken: string, fetcher: Fetch = fetch) {
  const res = await graph<{ status_code?: ContainerStatus; status?: string }>(
    containerId,
    { fields: "status_code,status", access_token: accessToken },
    fetcher,
  );
  return { code: res.status_code ?? "IN_PROGRESS", detail: res.status ?? "" };
}

/** Publishes a finished container. Returns the new post's media id. */
export async function publishContainer(
  accountId: string,
  containerId: string,
  accessToken: string,
  fetcher: Fetch = fetch,
) {
  const res = await graph<{ id?: string }>(
    `${accountId}/media_publish`,
    { creation_id: containerId, access_token: accessToken },
    fetcher,
    "POST",
  );
  if (!res.id) throw new InstagramError("Instagram didn't publish the video. Try again.", "unknown");
  return res.id;
}

/** The public link to a post (null if Instagram doesn't return one). */
export async function mediaPermalink(mediaId: string, accessToken: string, fetcher: Fetch = fetch) {
  const res = await graph<{ permalink?: string }>(
    mediaId,
    { fields: "permalink", access_token: accessToken },
    fetcher,
  ).catch(() => ({}) as { permalink?: string });
  return res.permalink ?? null;
}

/** The account's newest post (used when a container was published but the job stopped before saving it). */
export async function latestMedia(accountId: string, accessToken: string, fetcher: Fetch = fetch) {
  const res = await graph<{ data?: { id: string; permalink?: string }[] }>(
    `${accountId}/media`,
    { fields: "id,permalink", limit: "1", access_token: accessToken },
    fetcher,
  ).catch(() => ({}) as { data?: { id: string; permalink?: string }[] });
  const first = res.data?.[0];
  return first ? { id: first.id, permalink: first.permalink ?? null } : null;
}

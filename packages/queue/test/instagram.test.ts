import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectWithCode, InstagramError, instagramLoginUrl, missingInstagramSettings } from "../src/index";

const env = { META_APP_ID: "111", META_APP_SECRET: "secret", META_LOGIN_CONFIG_ID: "222", TOKEN_ENCRYPTION_KEY: "k" };
const redirect = "https://app.test/api/oauth/instagram/callback";

/** A fake Graph API: answers by path, records every URL it was asked for. */
const fakeGraph = (routes: Record<string, [number, unknown]>) => {
  const calls: URL[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    const path = url.pathname.replace(/^\/v[\d.]+\//, "");
    const [status, body] = routes[path] ?? [404, { error: { message: `no route ${path}`, code: 803 } }];
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fetcher, calls };
};

describe("Instagram (Unified login)", () => {
  beforeEach(() => Object.assign(process.env, env));
  afterEach(() => {
    for (const k of Object.keys(env)) delete process.env[k];
  });

  it("builds Meta's login URL from the configuration, with our state", () => {
    const url = new URL(instagramLoginUrl(redirect, "st4te"));
    expect(url.origin + url.pathname).toBe("https://www.facebook.com/dialog/oauth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "111",
      config_id: "222",
      redirect_uri: redirect,
      response_type: "code",
      override_default_response_type: "true",
      prompt: "login",
      state: "st4te",
    });
  });

  it("names missing settings", () => {
    delete process.env.META_LOGIN_CONFIG_ID;
    expect(missingInstagramSettings()).toEqual(["META_LOGIN_CONFIG_ID"]);
  });

  it("swaps the code for a key and reads the shared account", async () => {
    const { fetcher, calls } = fakeGraph({
      "oauth/access_token": [200, { access_token: "SUAT", token_type: "bearer" }],
      me: [200, { client_business_id: "biz1" }],
      "me/assigned_instagram_accounts": [200, { data: [{ id: "1784", username: "brand" }] }],
      "1784": [200, { username: "brand", name: "Brand Co", profile_picture_url: "https://cdn.test/p.jpg" }],
    });
    const result = await connectWithCode("CODE", redirect, fetcher);
    expect(result).toEqual({
      accessToken: "SUAT",
      clientBusinessId: "biz1",
      accounts: [{ id: "1784", username: "brand", name: "Brand Co", pictureUrl: "https://cdn.test/p.jpg" }],
    });
    const exchange = calls.find((c) => c.pathname.endsWith("oauth/access_token"));
    expect(exchange?.host).toBe("graph.facebook.com");
    expect(Object.fromEntries(exchange?.searchParams ?? [])).toMatchObject({
      client_id: "111",
      client_secret: "secret",
      code: "CODE",
    });
  });

  it("still connects when Meta returns no name or photo", async () => {
    const { fetcher } = fakeGraph({
      "oauth/access_token": [200, { access_token: "SUAT" }],
      me: [200, {}],
      "me/assigned_instagram_accounts": [200, { data: [{ id: "1784", username: "brand" }] }],
      "1784": [400, { error: { message: "unsupported", code: 100 } }],
    });
    const result = await connectWithCode("CODE", redirect, fetcher);
    expect(result.accounts).toEqual([{ id: "1784", username: "brand", name: null, pictureUrl: null }]);
  });

  it("explains a login that shared no professional account", async () => {
    const { fetcher } = fakeGraph({
      "oauth/access_token": [200, { access_token: "SUAT" }],
      me: [200, {}],
      "me/assigned_instagram_accounts": [200, { data: [] }],
    });
    await expect(connectWithCode("CODE", redirect, fetcher)).rejects.toMatchObject({ kind: "account" });
  });

  it("turns Meta errors into safe messages without the raw text", async () => {
    const personal = fakeGraph({
      "oauth/access_token": [200, { access_token: "SUAT" }],
      me: [200, {}],
      "me/assigned_instagram_accounts": [
        400,
        {
          error: {
            message: "(#10) Access is denied because the instagram account type is not business or creator",
            code: 10,
          },
        },
      ],
    });
    const err = await connectWithCode("CODE", redirect, personal.fetcher).catch((e) => e);
    expect(err).toBeInstanceOf(InstagramError);
    expect(err).toMatchObject({ kind: "account" });
    expect(err.message).toMatch(/Creator or Business/);

    const expired = fakeGraph({
      "oauth/access_token": [400, { error: { message: "code expired", code: 100, type: "OAuthException" } }],
    });
    await expect(connectWithCode("OLD", redirect, expired.fetcher)).rejects.toMatchObject({ kind: "unknown" });

    const busy = fakeGraph({ "oauth/access_token": [503, {}] });
    await expect(connectWithCode("CODE", redirect, busy.fetcher)).rejects.toMatchObject({ kind: "temporary" });
  });
});

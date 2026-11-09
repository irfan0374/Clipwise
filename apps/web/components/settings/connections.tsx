"use client";
import { Check, Info, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { disconnectSocialAccount } from "@/app/(app)/settings/actions";
import type { SettingsConnections } from "@/lib/settings";

// Settings → Connections, from the Stitch "Settings > Connections" screen. Icons are the screen's own outlines
// (Lucide has no brand icons).

const icon = (paths: React.ReactNode, size = 22) => (
  <svg
    aria-hidden="true"
    fill="none"
    width={size}
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    {paths}
  </svg>
);
const InstagramIcon = () =>
  icon(
    <>
      <rect height="20" rx="5" ry="5" width="20" x="2" y="2" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </>,
  );
const TikTokIcon = () => icon(<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />, 20);
const YouTubeIcon = () =>
  icon(
    <>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <polygon fill="currentColor" points="10 15 15 12 10 9 10 15" />
    </>,
    20,
  );

/** Messages for the ?error= flag the OAuth callback sets. */
const errors: Record<string, string> = {
  denied: "Instagram wasn't connected: the login was cancelled.",
  state: "That connection link expired. Click Connect Instagram again.",
  account:
    "No Creator or Business account was shared. Switch your account to Creator or Business in the Instagram app, then connect again and choose it.",
  auth: "Instagram didn't accept the login. Try connecting again.",
  temporary: "Instagram is busy right now. Try again in a few minutes.",
  setup: "Instagram connections aren't set up on this server yet.",
  unknown: "Instagram couldn't be connected. Try again.",
};

const lime =
  "shrink-0 rounded-lg bg-lime px-4 py-2 text-xs font-medium text-ink shadow-[0_4px_14px_0_rgba(198,244,50,0.35)] transition-all hover:brightness-105 active:scale-[0.98]";
const row = "flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-6";

function Avatar({ url, username, warn }: { url: string | null; username: string; warn?: boolean }) {
  return (
    <div className="relative shrink-0">
      <div className="flex size-11 items-center justify-center overflow-hidden rounded-full border border-line bg-wash text-xs font-semibold text-ink-2 shadow-2xs">
        {url ? (
          // Instagram's photo links are short-lived CDN URLs, so next/image (which caches) isn't used.
          // biome-ignore lint/performance/noImgElement: see above
          <img
            src={url}
            alt=""
            referrerPolicy="no-referrer"
            className={`size-full object-cover ${warn ? "opacity-75 grayscale" : ""}`}
          />
        ) : (
          username.slice(0, 2).toUpperCase()
        )}
      </div>
      {warn && (
        <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-amber text-[10px] font-bold text-white">
          !
        </span>
      )}
    </div>
  );
}

function ComingSoon({ name, text, children }: { name: string; text: string; children: React.ReactNode }) {
  return (
    <div className={`${row} bg-wash/40 opacity-60 select-none`}>
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-wash text-ink-3">
          {children}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h3 className="font-heading text-sm font-semibold text-ink-2">{name}</h3>
            <span className="rounded-md bg-line px-2 py-0.5 text-[10px] font-medium tracking-wider text-ink-2 uppercase">
              Coming soon
            </span>
          </div>
          <p className="text-xs text-ink-3">{text}</p>
        </div>
      </div>
      <button
        type="button"
        disabled
        className="shrink-0 cursor-not-allowed self-start rounded-lg border border-line bg-wash px-3.5 py-1.5 text-xs font-medium text-ink-3"
      >
        Notify me
      </button>
    </div>
  );
}

export function Connections({
  data,
  result,
}: {
  data: SettingsConnections;
  result: { connected?: string; error?: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const shown = useRef(false);

  // One message for the result of the Instagram login, then clean the address bar.
  useEffect(() => {
    if (shown.current || (!result.connected && !result.error)) return;
    shown.current = true;
    if (result.connected)
      toast.success(Number(result.connected) > 1 ? "Instagram accounts connected" : "Instagram connected");
    else toast.error(errors[result.error ?? ""] ?? errors.unknown);
    router.replace("/settings?tab=connections", { scroll: false });
  }, [result, router]);

  const disconnect = (id: string, username: string) =>
    start(async () => {
      try {
        const res = await disconnectSocialAccount({ accountId: id });
        if (!res.ok) toast.error(res.error.message);
        else {
          toast.success(`@${username} disconnected`);
          router.refresh();
        }
      } catch {
        toast.error("Couldn't disconnect. Try again.");
      }
    });

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xs">
        <div className="border-b border-line p-5 sm:p-6">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Connected accounts</h2>
          <p className="mt-0.5 text-xs text-ink-3">Post your videos straight from Clipwise.</p>
        </div>
        <div className="divide-y divide-line">
          <div className={`${row} transition-colors hover:bg-paper`}>
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-ink shadow-2xs">
                <InstagramIcon />
              </div>
              <div className="flex max-w-xl flex-col gap-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-heading text-sm font-semibold">Instagram</h3>
                  {!data.accounts.length && (
                    <span className="rounded-full bg-wash px-2 py-0.5 text-[11px] font-medium text-ink-3">
                      Disconnected
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-ink-2">
                  Post Reels straight from Clipwise. Log in with Instagram, no Facebook needed.
                </p>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  Needs a Creator or Business account (free to switch in the Instagram app).
                </p>
                {/* Meta's login page always offers Facebook too; point people to the Instagram button. */}
                <p className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg bg-wash px-2.5 py-1.5 text-[11px] text-ink-2">
                  <Info className="size-3.5 shrink-0 text-ink-3" />
                  <span>
                    On Meta&apos;s next screen, choose{" "}
                    <span className="font-semibold text-ink">Continue with Instagram</span>.
                  </span>
                </p>
              </div>
            </div>
            {data.available ? (
              <a href="/api/oauth/instagram/start" className={`${lime} self-start text-center`}>
                {data.accounts.length ? "Connect another" : "Connect Instagram"}
              </a>
            ) : (
              <span className="self-start text-[11px] text-ink-3">Not available yet</span>
            )}
          </div>

          {data.accounts.map((a) =>
            a.status === "reconnect" ? (
              <div key={a.id} className={`${row} bg-amber-soft/30 transition-colors hover:bg-amber-soft/50`}>
                <div className="flex items-start gap-4">
                  <Avatar url={a.pictureUrl} username={a.username} warn />
                  <div className="flex max-w-xl flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-heading text-sm font-semibold">@{a.username}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/30 bg-amber-soft px-2 py-0.5 text-[11px] font-medium text-amber-ink">
                        <span className="size-1.5 rounded-full bg-amber" />
                        Reconnect needed
                      </span>
                    </div>
                    <p className="text-xs font-medium text-amber-ink">
                      {a.statusReason ?? "Instagram access expired."}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-3">Connect again to keep posting from Clipwise.</p>
                  </div>
                </div>
                {data.available && (
                  <a href="/api/oauth/instagram/start" className={`${lime} self-start text-center`}>
                    Reconnect
                  </a>
                )}
              </div>
            ) : (
              <div key={a.id} className={`${row} transition-colors hover:bg-paper`}>
                <div className="flex items-start gap-4">
                  <Avatar url={a.pictureUrl} username={a.username} />
                  <div className="flex max-w-xl flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-heading text-sm font-semibold">@{a.username}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/20 bg-teal-soft px-2 py-0.5 text-[11px] font-medium text-teal-ink">
                        <span className="size-1.5 animate-pulse rounded-full bg-teal" />
                        Connected
                      </span>
                    </div>
                    <p className="text-xs text-ink-3">
                      {a.name ? `${a.name} · ` : ""}Professional account · Access stays on until you disconnect
                    </p>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-3">
                      <Check className="size-3" strokeWidth={2} />
                      Ready to post 1080p vertical Reels
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => disconnect(a.id, a.username)}
                  className="flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-line bg-panel px-4 py-2 text-xs font-medium text-ink-2 shadow-2xs transition-all hover:border-red/30 hover:bg-red-soft/40 hover:text-red-ink active:scale-[0.98] disabled:opacity-50"
                >
                  {pending && <Loader2 className="size-3 animate-spin" />}
                  Disconnect
                </button>
              </div>
            ),
          )}

          <ComingSoon name="TikTok" text="Direct auto-publishing for TikTok short videos and creator campaigns.">
            <TikTokIcon />
          </ComingSoon>
          <ComingSoon name="YouTube Shorts" text="Schedule and publish 1080p Shorts directly to your channel.">
            <YouTubeIcon />
          </ComingSoon>
        </div>
      </section>
      <div className="flex items-start gap-3.5 rounded-xl border border-line bg-panel p-4 text-xs text-ink-2 shadow-2xs">
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-wash text-ink-3">
          <Info className="size-3.5" />
        </div>
        <div className="flex flex-col gap-0.5 leading-relaxed">
          <span className="font-medium text-ink">Why Creator or Business?</span>
          <p className="text-ink-3">
            Instagram only lets apps post to professional accounts. Switching is free and keeps your followers.
          </p>
        </div>
      </div>
    </>
  );
}

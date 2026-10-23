"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

export type AuthTab = "sign-in" | "sign-up";

/** Turns Better Auth's error into something a person can act on. */
export function friendlyAuthError(error: { status?: number; code?: string; message?: string }): string {
  if (error.status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  if (
    error.code === "USER_ALREADY_EXISTS" ||
    error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
    error.status === 422
  )
    return "An account with this email already exists. Sign in instead.";
  if (error.code === "INVALID_EMAIL_OR_PASSWORD" || error.status === 401) return "Wrong email or password.";
  if (error.code === "PASSWORD_TOO_SHORT") return "Use at least 8 characters for your password.";
  if (error.code === "INVALID_EMAIL") return "Enter a valid email address.";
  return "Something went wrong. Please try again.";
}

function Field({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} required {...props} />
    </div>
  );
}

export function AuthForms({ initialTab }: { initialTab: AuthTab }) {
  const router = useRouter();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (kind: AuthTab) => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    setBusy(true);
    setError(null);
    const { error } =
      kind === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name: String(f.get("name") ?? "").trim(), email, password });
    if (error) {
      setError(friendlyAuthError(error));
      setBusy(false);
      return;
    }
    router.push("/create");
    router.refresh();
  };

  return (
    <>
      <div className="mt-8 mb-6 space-y-2">
        <h1 className="text-h2">{tab === "sign-up" ? "Create your account" : "Welcome back"}</h1>
        <p className="text-ink-2">
          {tab === "sign-up" ? "Free during the beta. No card needed." : "Sign in to turn your next idea into a video."}
        </p>
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as AuthTab);
          setError(null);
        }}
        className="gap-6"
      >
        <TabsList className="grid h-10 w-full grid-cols-2 bg-wash p-1">
          <TabsTrigger value="sign-in" className="data-active:bg-panel data-active:text-ink">
            Sign in
          </TabsTrigger>
          <TabsTrigger value="sign-up" className="data-active:bg-panel data-active:text-ink">
            Create account
          </TabsTrigger>
        </TabsList>

        {error && (
          <p role="alert" className="rounded-lg bg-red-soft px-3 py-2 text-small text-red-ink">
            {error}
          </p>
        )}

        <TabsContent value="sign-in">
          <form onSubmit={submit("sign-in")} className="space-y-4">
            <Field id="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" />
            <Field id="password" label="Password" type="password" autoComplete="current-password" />
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Sign in
            </Button>
            <p className="text-center text-small text-ink-3">Forgot your password? Ask us and we'll reset it.</p>
          </form>
        </TabsContent>

        <TabsContent value="sign-up">
          <form onSubmit={submit("sign-up")} className="space-y-4">
            <Field id="name" label="Name" autoComplete="name" placeholder="Your name" maxLength={80} />
            <Field id="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" />
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="-mt-2 text-label text-ink-3">
              At least 8 characters.
            </p>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Create free account
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </>
  );
}

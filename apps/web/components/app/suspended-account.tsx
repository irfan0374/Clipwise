"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
export function SuspendedAccount() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-line bg-panel p-8">
      <h1 className="text-2xl font-semibold">Your workspace is suspended</h1>
      <p className="my-4 text-sm text-ink-2">
        You can't create, edit or download videos while this workspace is suspended. Contact the administrator for help.
      </p>
      <button
        type="button"
        className="rounded-lg bg-lime px-4 py-2 text-sm font-medium"
        onClick={async () => {
          await authClient.signOut();
          router.push("/sign-in");
          router.refresh();
        }}
      >
        Sign out
      </button>
    </div>
  );
}

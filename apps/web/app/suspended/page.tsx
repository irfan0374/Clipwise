import { redirect } from "next/navigation";
import { SuspendedAccount } from "@/components/app/suspended-account";
import { getSession } from "@/lib/session";
export default async function SuspendedPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!session.user.suspendedAt) redirect("/create");
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-4">
      <SuspendedAccount />
    </main>
  );
}

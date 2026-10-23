import type { ReactNode } from "react";
import { Sidebar } from "@/components/app/sidebar";
import { requireUser } from "@/lib/session";

/** Shell for signed-in pages: sidebar on the left, content up to 1120px wide. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireUser();
  return (
    <div className="min-h-screen">
      <Sidebar user={{ name: user.name, email: user.email, image: user.image ?? null, role: user.role ?? "user" }} />
      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-8 lg:py-12">{children}</div>
      </main>
    </div>
  );
}

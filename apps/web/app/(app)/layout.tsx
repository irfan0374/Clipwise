import { dailyUsage } from "@clipwise/queue";
import type { ReactNode } from "react";
import { PageFrame } from "@/components/app/page-frame";
import { Sidebar } from "@/components/app/sidebar";
import { requireUser } from "@/lib/session";

/** Shell for signed-in pages: sidebar on the left, content in a PageFrame. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireUser();
  const usage = await dailyUsage(user.id);
  return (
    <div className="min-h-screen">
      <Sidebar
        user={{ name: user.name, email: user.email, image: user.image ?? null, role: user.role ?? "user" }}
        usage={usage.videos}
      />
      <main className="lg:pl-60">
        <PageFrame>{children}</PageFrame>
      </main>
    </div>
  );
}

import type { ReactNode } from "react";
import { Sidebar } from "@/components/app/sidebar";

/** Shell for signed-in pages: sidebar on the left, content up to 1120px wide. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-8 lg:py-12">{children}</div>
      </main>
    </div>
  );
}

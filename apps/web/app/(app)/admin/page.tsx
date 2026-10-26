import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/dashboard";
import { adminOverview, requireAdmin } from "@/lib/admin";
export const metadata: Metadata = { title: "Admin" };
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { user } = await requireAdmin();
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q.slice(0, 80) : "";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const data = await adminOverview(search, page);
  return <AdminDashboard data={data} search={search} actorId={user.id} />;
}

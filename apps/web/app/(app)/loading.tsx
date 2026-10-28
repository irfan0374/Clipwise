import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingPage() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <Skeleton className="h-9 w-64 bg-wash" />
      <Skeleton className="h-4 w-96 max-w-full bg-wash" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["a", "b", "c"].map((k) => (
          <Skeleton key={k} className="h-40 rounded-xl bg-wash" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

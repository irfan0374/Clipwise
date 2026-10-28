import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingVideos() {
  return (
    <div role="status" aria-label="Loading your videos" className="space-y-6">
      <Skeleton className="h-9 w-48 bg-wash" />
      <Skeleton className="h-10 w-full rounded-lg bg-wash" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {["a", "b", "c", "d", "e", "f", "g", "h"].map((k) => (
          <Skeleton key={k} className="aspect-[9/16] rounded-xl bg-wash" />
        ))}
      </div>
      <span className="sr-only">Loading your videos…</span>
    </div>
  );
}

import { Progress } from "@/components/ui/progress";

/** Sidebar usage. Real numbers arrive with limits (Feature 13); until then the shell passes sample values. */
export function UsageMeter({ used, limit, label }: { used: number; limit: number; label: string }) {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-panel p-3">
      <div className="flex items-baseline justify-between text-label">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-ink-2 tabular-nums">
          {used} / {limit}
        </span>
      </div>
      <Progress value={(used / limit) * 100} aria-label={`${label}: ${used} of ${limit}`} />
    </div>
  );
}

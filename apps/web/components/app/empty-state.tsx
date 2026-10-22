import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-[#d6d6cd] bg-panel/60 px-6 py-14 text-center">
      <span className="mb-4 grid size-11 place-items-center rounded-xl border border-line bg-panel text-ink-2">
        <Icon className="size-5" strokeWidth={1.5} />
      </span>
      <h3 className="text-h3">{title}</h3>
      <p className="mt-1.5 max-w-sm text-small text-ink-2">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

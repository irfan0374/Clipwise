"use client";

import { cn } from "cn";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Option<T extends string> = { value: T; label: string };

/** Pill-shaped single choice (format chips). The selected chip is ink. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      spacing={2}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("flex-wrap", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-8 rounded-full! border border-line bg-panel px-3.5 text-small text-ink-2 hover:border-[#d6d6cd] hover:bg-panel hover:text-ink data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:text-white"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

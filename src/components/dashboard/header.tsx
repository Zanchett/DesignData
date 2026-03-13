"use client";

import { DateRangePicker } from "./date-range-picker";
import { SyncStatusBadge } from "./sync-status-badge";
import type { DateRange } from "@/hooks/use-date-range";

interface HeaderProps {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onPreset: (preset: string) => void;
}

export function Header({ range, onRangeChange, onPreset }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <SyncStatusBadge />
      </div>
      <DateRangePicker
        range={range}
        onRangeChange={onRangeChange}
        onPreset={onPreset}
      />
    </header>
  );
}

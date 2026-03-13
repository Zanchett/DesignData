"use client";

import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/hooks/use-date-range";

interface DateRangePickerProps {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onPreset: (preset: string) => void;
}

const presets = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "90D", value: "90d" },
];

export function DateRangePicker({ range, onRangeChange, onPreset }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Preset buttons */}
      <div className="hidden items-center gap-1 md:flex">
        {presets.map((p) => (
          <Button
            key={p.value}
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onPreset(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Calendar picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 justify-start gap-2 text-xs font-normal",
              !range && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {range?.from ? (
              range.to ? (
                <>
                  {format(range.from, "MMM d")} – {format(range.to, "MMM d, yyyy")}
                </>
              ) : (
                format(range.from, "MMM d, yyyy")
              )
            ) : (
              "Pick dates"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            defaultMonth={range.from}
            selected={{ from: range.from, to: range.to }}
            onSelect={(selected) => {
              if (selected?.from && selected?.to) {
                onRangeChange({ from: selected.from, to: selected.to });
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

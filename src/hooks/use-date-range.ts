"use client";

import { useState, useCallback } from "react";
import { subDays, startOfMonth, endOfMonth, subMonths, formatISO } from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
}

function defaultRange(): DateRange {
  const now = new Date();
  return { from: subDays(now, 30), to: now };
}

export function useDateRange() {
  const [range, setRange] = useState<DateRange>(defaultRange);

  const startDate = formatISO(range.from);
  const endDate = formatISO(range.to);

  const setPreset = useCallback((preset: string) => {
    const now = new Date();
    switch (preset) {
      case "7d":
        setRange({ from: subDays(now, 7), to: now });
        break;
      case "30d":
        setRange({ from: subDays(now, 30), to: now });
        break;
      case "this_month":
        setRange({ from: startOfMonth(now), to: now });
        break;
      case "last_month": {
        const lastMonth = subMonths(now, 1);
        setRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        break;
      }
      case "90d":
        setRange({ from: subDays(now, 90), to: now });
        break;
    }
  }, []);

  return { range, setRange, startDate, endDate, setPreset };
}

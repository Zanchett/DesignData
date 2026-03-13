"use client";

import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { useDateRange } from "@/hooks/use-date-range";
import { createContext, useContext, useState, useEffect } from "react";
import type { MetricType } from "@/lib/constants";

interface DateContextType {
  startDate: string;
  endDate: string;
}

interface MetricContextType {
  metric: MetricType;
  setMetric: (m: MetricType) => void;
}

const DateContext = createContext<DateContextType>({
  startDate: "",
  endDate: "",
});

const MetricContext = createContext<MetricContextType>({
  metric: "tracked",
  setMetric: () => {},
});

export const useDateContext = () => useContext(DateContext);
export const useMetricContext = () => useContext(MetricContext);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { range, setRange, startDate, endDate, setPreset } = useDateRange();
  const [metric, setMetric] = useState<MetricType>("tracked");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render a shell during SSR / before hydration to avoid Radix ID mismatches
  if (!mounted) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 pl-64 min-w-0 overflow-hidden">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm" />
          <main className="p-6">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <DateContext.Provider value={{ startDate, endDate }}>
      <MetricContext.Provider value={{ metric, setMetric }}>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 pl-64 min-w-0 overflow-hidden">
            <Header
              range={range}
              onRangeChange={setRange}
              onPreset={setPreset}
            />
            <main className="p-6">{children}</main>
          </div>
        </div>
      </MetricContext.Provider>
    </DateContext.Provider>
  );
}

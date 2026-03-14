"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimeTrends } from "@/hooks/use-analytics";
import { useDateContext, useMetricContext } from "../layout";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { format, parseISO } from "date-fns";

const COLORS = [
  "oklch(0.62 0.19 255)",  // Brand Blue
  "oklch(0.52 0.22 350)",  // Brand Pink
  "oklch(0.68 0.14 160)",  // Brand Green
  "oklch(0.48 0.28 290)",  // Brand Purple
  "oklch(0.72 0.14 55)",   // Brand Orange
  "oklch(0.58 0.16 220)",  // Teal
];

export default function TimeAnalysisPage() {
  const { startDate, endDate } = useDateContext();
  const { metric } = useMetricContext();
  const [granularity, setGranularity] = useState("week");
  const { data, isLoading } = useTimeTrends(startDate, endDate, granularity, metric);

  const trends = (data?.trends || []).map(
    (t: { period_start: string; total_hours: number; tasks_completed: number; active_designers: number }) => ({
      ...t,
      label: format(parseISO(t.period_start), granularity === "week" ? "MMM d" : "MMM yyyy"),
    })
  );

  // Workload distribution: pivot data by designer
  const workloadRaw: { period_start: string; username: string; hours: number }[] =
    data?.workload || [];
  const designers = [...new Set(workloadRaw.map((w) => w.username))].slice(0, 8);
  const periods = [...new Set(workloadRaw.map((w) => w.period_start))].sort();

  const workloadData = periods.map((p) => {
    const row: Record<string, string | number> = {
      label: format(parseISO(p), granularity === "week" ? "MMM d" : "MMM yyyy"),
    };
    designers.forEach((d) => {
      const entry = workloadRaw.find((w) => w.period_start === p && w.username === d);
      row[d] = entry?.hours || 0;
    });
    return row;
  });

  const tooltipStyle = {
    borderRadius: "10px",
    border: "1px solid oklch(0.27 0.025 255)",
    background: "oklch(0.19 0.03 255)",
    fontSize: "12px",
    color: "oklch(0.93 0.005 255)",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Time Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Trends and workload distribution over time
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={granularity === "week" ? "default" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setGranularity("week")}
          >
            Weekly
          </Button>
          <Button
            size="sm"
            variant={granularity === "month" ? "default" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setGranularity("month")}
          >
            Monthly
          </Button>
        </div>
      </div>

      {/* Hours Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Hours Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="hoursGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.62 0.19 255)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.62 0.19 255)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.27 0.025 255)" strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="total_hours"
                  stroke="oklch(0.62 0.19 255)"
                  fill="url(#hoursGradient)"
                  strokeWidth={2}
                  name="Hours"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tasks & Designers Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Tasks Completed & Active Designers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trends}>
                  <CartesianGrid stroke="oklch(0.27 0.025 255)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="tasks_completed"
                    stroke="oklch(0.68 0.14 160)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Tasks Completed"
                  />
                  <Line
                    type="monotone"
                    dataKey="active_designers"
                    stroke="oklch(0.72 0.14 55)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Active Designers"
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>

        {/* Workload Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Workload Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : workloadData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={workloadData}>
                  <CartesianGrid stroke="oklch(0.27 0.025 255)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  {designers.map((d, i) => (
                    <Area
                      key={d}
                      type="monotone"
                      dataKey={d}
                      stackId="1"
                      stroke={COLORS[i % COLORS.length]}
                      fill={COLORS[i % COLORS.length]}
                      fillOpacity={0.6}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[280px] items-center justify-center">
      <p className="text-sm text-muted-foreground">No data for this period.</p>
    </div>
  );
}

"use client";

import { Clock, CheckCircle2, Users, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/cards/kpi-card";
import { useOverview } from "@/hooks/use-analytics";
import { useDateContext } from "./layout";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = [
  "oklch(0.62 0.19 255)",  // Brand Blue
  "oklch(0.52 0.22 350)",  // Brand Pink
  "oklch(0.68 0.14 160)",  // Brand Green
  "oklch(0.48 0.28 290)",  // Brand Purple
  "oklch(0.72 0.14 55)",   // Brand Orange
  "oklch(0.58 0.16 220)",  // Teal
  "oklch(0.65 0.12 30)",   // Coral
  "oklch(0.60 0.14 130)",  // Olive
];

const TOOLTIP_STYLE = {
  borderRadius: "10px",
  border: "1px solid oklch(0.27 0.025 255)",
  background: "oklch(0.19 0.03 255)",
  fontSize: "12px",
  color: "oklch(0.93 0.005 255)",
};

function fmtHours(v: number): string {
  return `${Math.round(v * 10) / 10}h`;
}

export default function OverviewPage() {
  const { startDate, endDate } = useDateContext();
  // Overview always uses tracked time
  const { data, isLoading } = useOverview(startDate, endDate, "tracked");

  const topDesigners = (data?.topDesigners || []).map(
    (d: { username: string; total_hours: number }) => ({
      name: d.username?.length > 14 ? d.username.slice(0, 14) + "\u2026" : d.username,
      hours: Math.round(d.total_hours * 10) / 10,
    })
  );

  const statusData = Object.entries(data?.statusDistribution || {}).map(
    ([name, value]) => ({
      name: name
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      value: value as number,
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Overview</h2>
        <p className="text-sm text-muted-foreground">
          High-level performance metrics across your agency
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Hours"
          value={data?.totalHours != null ? fmtHours(data.totalHours) : "\u2014"}
          subtitle="Tracked time"
          icon={Clock}
          loading={isLoading}
        />
        <KpiCard
          title="Tasks Completed"
          value={data?.completedTasks?.toLocaleString() ?? "\u2014"}
          subtitle={`${data?.completionRate ?? 0}% completion rate`}
          icon={CheckCircle2}
          loading={isLoading}
        />
        <KpiCard
          title="Active Designers"
          value={data?.activeDesigners ?? "\u2014"}
          subtitle="Team members"
          icon={Users}
          loading={isLoading}
        />
        <KpiCard
          title="Active Clients"
          value={data?.activeClients ?? "\u2014"}
          subtitle="Client folders"
          icon={Briefcase}
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Designers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Top Designers by Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : topDesigners.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={topDesigners}
                  layout="vertical"
                  margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
                >
                  <XAxis
                    type="number"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => [fmtHours(value), "Hours"]}
                  />
                  <Bar
                    dataKey="hours"
                    fill="oklch(0.62 0.19 255)"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No data yet. Run a sync first." />
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Task Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    stroke="none"
                  >
                    {statusData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend
                    wrapperStyle={{ fontSize: "10px", paddingTop: "12px" }}
                    iconSize={8}
                    formatter={(value: string) =>
                      value.length > 18 ? value.slice(0, 18) + "\u2026" : value
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No tasks found for this period." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

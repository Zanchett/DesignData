"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/dashboard/data-table";
import { DesignerTasksModal } from "@/components/dashboard/designer-tasks-modal";
import { useDesignerMetrics } from "@/hooks/use-analytics";
import { useDateContext } from "../layout";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

const TOOLTIP_STYLE = {
  borderRadius: "8px",
  border: "1px solid oklch(0.25 0.015 260)",
  background: "oklch(0.17 0.015 260)",
  fontSize: "12px",
  color: "oklch(0.93 0.005 260)",
};

function fmtHours(v: number): string {
  return `${Math.round(v * 10) / 10}h`;
}

interface Designer {
  designer_id: number;
  username: string;
  profile_picture: string | null;
  total_tasks: number;
  tasks_completed: number;
  completion_rate: number;
  total_hours: number;
  active_tasks: number;
}

const columns: ColumnDef<Designer, unknown>[] = [
  {
    accessorKey: "username",
    header: "Designer",
    cell: ({ row }) => {
      const d = row.original;
      return (
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7">
            {d.profile_picture && <AvatarImage src={d.profile_picture} />}
            <AvatarFallback className="text-[10px]">
              {d.username?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{d.username}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "total_hours",
    header: "Hours",
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{fmtHours(getValue<number>())}</span>
    ),
  },
  {
    accessorKey: "total_tasks",
    header: "Tasks",
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: "tasks_completed",
    header: "Completed",
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: "completion_rate",
    header: "Rate",
    cell: ({ getValue }) => {
      const rate = getValue<number>() ?? 0;
      return (
        <Badge variant={rate >= 70 ? "default" : "secondary"} className="font-mono text-xs">
          {rate}%
        </Badge>
      );
    },
  },
  {
    accessorKey: "active_tasks",
    header: "Active",
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{getValue<number>()}</span>
    ),
  },
];

export default function DesignersPage() {
  const { startDate, endDate } = useDateContext();
  // Designers always use tracked time (no billable assignment per designer)
  const { data, isLoading } = useDesignerMetrics(startDate, endDate, "tracked");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<{
    open: boolean;
    designerId: number | null;
    designerName: string;
  }>({ open: false, designerId: null, designerName: "" });

  const designers: Designer[] = data?.designers || [];

  const chartData = designers.slice(0, 15).map((d) => ({
    name: d.username?.length > 10 ? d.username.slice(0, 10) + "\u2026" : d.username,
    hours: Math.round(d.total_hours * 10) / 10,
    tasks: d.tasks_completed,
  }));

  // Radar chart: compare selected designers (or top 3)
  const compareDesigners =
    selected.size >= 2
      ? designers.filter((d) => selected.has(d.designer_id))
      : designers.slice(0, 3);

  const maxHours = Math.max(...designers.map((d) => d.total_hours), 1);
  const maxTasks = Math.max(...designers.map((d) => d.total_tasks), 1);
  const maxCompleted = Math.max(...designers.map((d) => d.tasks_completed), 1);

  const radarMetrics = ["Hours", "Tasks", "Completed", "Rate"];
  const radarData = radarMetrics.map((m) => {
    const row: Record<string, string | number> = { metric: m };
    compareDesigners.forEach((d) => {
      switch (m) {
        case "Hours":
          row[d.username] = Math.round((d.total_hours / maxHours) * 100);
          break;
        case "Tasks":
          row[d.username] = Math.round((d.total_tasks / maxTasks) * 100);
          break;
        case "Completed":
          row[d.username] = Math.round((d.tasks_completed / maxCompleted) * 100);
          break;
        case "Rate":
          row[d.username] = d.completion_rate || 0;
          break;
      }
    });
    return row;
  });

  const RADAR_COLORS = [
    "oklch(0.65 0.18 260)",
    "oklch(0.65 0.17 160)",
    "oklch(0.7 0.17 50)",
  ];

  const handleRowClick = (d: Designer) => {
    setModal({
      open: true,
      designerId: d.designer_id,
      designerName: d.username,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Designer Leaderboard</h2>
        <p className="text-sm text-muted-foreground">
          Performance rankings across all designers
        </p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Hours & Completed Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ bottom: 70, left: 0, right: 8, top: 8 }}>
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    tickLine={false}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    height={70}
                  />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => {
                      if (name === "Hours" || name === "hours") return [fmtHours(value), "Hours"];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="hours" fill="oklch(0.65 0.18 260)" radius={[4, 4, 0, 0]} name="Hours" />
                  <Bar dataKey="tasks" fill="oklch(0.65 0.17 160)" radius={[4, 4, 0, 0]} name="Completed" />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} iconSize={8} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center">
                <p className="text-sm text-muted-foreground">No data for this period.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Designer Comparison
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Click rows in the table to compare designers (max 3)
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : compareDesigners.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="oklch(0.25 0.015 260)" />
                  <PolarAngleAxis dataKey="metric" fontSize={11} />
                  <PolarRadiusAxis fontSize={10} domain={[0, 100]} />
                  {compareDesigners.map((d, i) => (
                    <Radar
                      key={d.designer_id}
                      name={d.username}
                      dataKey={d.username}
                      stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
                      fill={RADAR_COLORS[i % RADAR_COLORS.length]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: "11px" }} iconSize={8} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center">
                <p className="text-sm text-muted-foreground">No data for this period.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">All Designers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={designers}
              searchKey="username"
              searchPlaceholder="Search designers..."
              onRowClick={handleRowClick}
            />
          )}
        </CardContent>
      </Card>

      {/* Designer Tasks Modal */}
      <DesignerTasksModal
        open={modal.open}
        onOpenChange={(open) => setModal((prev) => ({ ...prev, open }))}
        designerId={modal.designerId}
        designerName={modal.designerName}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}

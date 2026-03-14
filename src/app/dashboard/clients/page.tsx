"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/dashboard/data-table";
import { DesignerClientDetailModal } from "@/components/dashboard/designer-client-detail-modal";
import { useClientMetrics } from "@/hooks/use-analytics";
import { useDateContext, useMetricContext } from "../layout";
import { Clock, DollarSign } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { useState, useCallback } from "react";
import type { ColumnDef } from "@tanstack/react-table";

const COLORS = [
  "oklch(0.62 0.19 255)",  // Brand Blue
  "oklch(0.52 0.22 350)",  // Brand Pink
  "oklch(0.68 0.14 160)",  // Brand Green
  "oklch(0.48 0.28 290)",  // Brand Purple
  "oklch(0.72 0.14 55)",   // Brand Orange
  "oklch(0.58 0.16 220)",  // Teal
  "oklch(0.65 0.12 30)",   // Coral
  "oklch(0.60 0.14 130)",  // Olive
  "oklch(0.55 0.18 280)",  // Indigo
  "oklch(0.70 0.12 100)",  // Lime
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

interface Client {
  client_id: number;
  client_name: string;
  total_tasks: number;
  completed_tasks: number;
  designers_involved: number;
  total_hours: number;
}

const columns: ColumnDef<Client, unknown>[] = [
  {
    accessorKey: "client_name",
    header: "Client",
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue<string>()}</span>
    ),
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
    header: "Total Tasks",
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: "completed_tasks",
    header: "Completed",
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: "designers_involved",
    header: "Designers",
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{getValue<number>()}</span>
    ),
  },
  {
    id: "avg",
    header: "Avg h/Task",
    accessorFn: (row) => row.total_tasks > 0 ? (row.total_hours / row.total_tasks) : 0,
    cell: ({ getValue }) => {
      const v = getValue<number>();
      return (
        <span className="font-mono text-sm">
          {v > 0 ? `${v.toFixed(1)}h` : "\u2014"}
        </span>
      );
    },
  },
];

interface ModalState {
  open: boolean;
  designerId: number | null;
  designerName: string;
  clientId: number | null;
  clientName: string;
}

export default function ClientsPage() {
  const { startDate, endDate } = useDateContext();
  const { metric, setMetric } = useMetricContext();
  const { data, isLoading } = useClientMetrics(startDate, endDate, metric);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    designerId: null,
    designerName: "",
    clientId: null,
    clientName: "",
  });

  const clients: Client[] = data?.clients || [];
  const breakdown: Record<string, Record<string, number>> =
    data?.clientDesignerBreakdown || {};
  const designerIdMap: Record<string, Record<string, number>> =
    data?.clientDesignerIdMap || {};

  // Pie chart: top 10 clients by hours
  const pieData = clients
    .filter((c) => c.total_hours > 0)
    .slice(0, 10)
    .map((c) => ({
      name: c.client_name.length > 18 ? c.client_name.slice(0, 18) + "\u2026" : c.client_name,
      value: Math.round(c.total_hours * 10) / 10,
    }));

  // Stacked bar: top 8 clients with designer breakdown
  const topClients = clients.filter((c) => c.total_hours > 0).slice(0, 8);
  const allDesignerNames = new Set<string>();
  topClients.forEach((c) => {
    const designers = breakdown[String(c.client_id)] || {};
    Object.keys(designers).forEach((name) => allDesignerNames.add(name));
  });
  const designerNames = Array.from(allDesignerNames).slice(0, 6);

  const stackedData = topClients.map((c) => {
    const designers = breakdown[String(c.client_id)] || {};
    const row: Record<string, string | number> = {
      name: c.client_name.length > 12 ? c.client_name.slice(0, 12) + "\u2026" : c.client_name,
      clientId: c.client_id,
      fullName: c.client_name,
    };
    designerNames.forEach((dn) => {
      row[dn] = Math.round((designers[dn] || 0) * 10) / 10;
    });
    return row;
  });

  const handleBarClick = useCallback(
    (designerName: string, entry: Record<string, string | number>) => {
      const clientId = Number(entry.clientId);
      const clientName = String(entry.fullName || entry.name);
      const idMap = designerIdMap[String(clientId)] || {};
      const designerId = idMap[designerName] ? Number(idMap[designerName]) : null;

      if (designerId) {
        setModal({
          open: true,
          designerId,
          designerName,
          clientId,
          clientName,
        });
      }
    },
    [designerIdMap]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Client Breakdown</h2>
          <p className="text-sm text-muted-foreground">
            Resource allocation and workload per client
          </p>
        </div>
        {/* Metric toggle — clients only */}
        <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
          <Button
            variant={metric === "tracked" ? "default" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-3 text-xs"
            onClick={() => setMetric("tracked")}
          >
            <Clock className="h-3 w-3" />
            Tracked Time
          </Button>
          <Button
            variant={metric === "billable" ? "default" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-3 text-xs"
            onClick={() => setMetric("billable")}
          >
            <DollarSign className="h-3 w-3" />
            Billable Time
          </Button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Hours Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[320px] w-full" />
            ) : pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => [fmtHours(value), "Hours"]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "10px", paddingTop: "12px" }}
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Hours by Designer per Client
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Click a bar segment to see task details
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[320px] w-full" />
            ) : stackedData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={stackedData} margin={{ bottom: 70, left: 0, right: 8, top: 8 }}>
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    tickLine={false}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    height={70}
                  />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => [fmtHours(value), name]}
                  />
                  {designerNames.map((dn, i) => (
                    <Bar
                      key={dn}
                      dataKey={dn}
                      stackId="a"
                      fill={COLORS[i % COLORS.length]}
                      radius={i === designerNames.length - 1 ? [4, 4, 0, 0] : undefined}
                      className="cursor-pointer"
                      onClick={(barData) => {
                        if (barData?.payload) {
                          handleBarClick(dn, barData.payload as Record<string, string | number>);
                        }
                      }}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ fontSize: "10px", paddingTop: "4px" }}
                    iconSize={8}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">All Clients</CardTitle>
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
              data={clients}
              searchKey="client_name"
              searchPlaceholder="Search clients..."
            />
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <DesignerClientDetailModal
        open={modal.open}
        onOpenChange={(open) => setModal((prev) => ({ ...prev, open }))}
        designerId={modal.designerId}
        designerName={modal.designerName}
        clientId={modal.clientId}
        clientName={modal.clientName}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[320px] items-center justify-center">
      <p className="text-sm text-muted-foreground">No data for this period.</p>
    </div>
  );
}

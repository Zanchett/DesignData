"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ReportData } from "@/lib/report-utils";
import { ReportSummary } from "./report-summary";

type SortKey = "name" | "billable_time" | string;
type SortDir = "asc" | "desc";

/* ── Color palette for custom field badges ── */
const FIELD_BADGE_PALETTE = [
  { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/25" },
  { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/25" },
  { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/25" },
  { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/25" },
  { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/25" },
  { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/25" },
  { bg: "bg-indigo-500/15", text: "text-indigo-400", border: "border-indigo-500/25" },
  { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/25" },
  { bg: "bg-teal-500/15", text: "text-teal-400", border: "border-teal-500/25" },
  { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/25" },
  { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/25" },
  { bg: "bg-lime-500/15", text: "text-lime-400", border: "border-lime-500/25" },
];

interface ReportViewProps {
  data: ReportData;
  /** If true, shows the brand header for public/shared view */
  showBrandHeader?: boolean;
}

export function ReportView({ data, showBrandHeader }: ReportViewProps) {
  const { client, month, year, tasks, totalBillable, summary, customFieldColumns } = data;
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        // Third click resets
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedTasks = useMemo(() => {
    if (!sortKey) return tasks;
    return [...tasks].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      if (sortKey === "name") {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      } else if (sortKey === "billable_time") {
        aVal = a.billable_time ?? -1;
        bVal = b.billable_time ?? -1;
      } else {
        // Custom field column
        aVal = (a.custom_fields[sortKey] || "").toLowerCase();
        bVal = (b.custom_fields[sortKey] || "").toLowerCase();
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [tasks, sortKey, sortDir]);

  // Build a color map for each custom field column: { "Team": { "Team A": palette[0], "Team B": palette[1], ... } }
  const fieldColorMap = useMemo(() => {
    const map: Record<string, Record<string, (typeof FIELD_BADGE_PALETTE)[0]>> = {};
    for (const col of customFieldColumns) {
      const uniqueValues = Array.from(
        new Set(tasks.map((t) => t.custom_fields[col]).filter(Boolean))
      ).sort();
      const colorAssignment: Record<string, (typeof FIELD_BADGE_PALETTE)[0]> = {};
      uniqueValues.forEach((val, i) => {
        colorAssignment[val] = FIELD_BADGE_PALETTE[i % FIELD_BADGE_PALETTE.length];
      });
      map[col] = colorAssignment;
    }
    return map;
  }, [tasks, customFieldColumns]);

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3 text-primary" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      {showBrandHeader && (
        <div className="flex items-center gap-3 pb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/25">
            <svg
              className="h-4 w-4 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M3 3v18h18" />
              <path d="M7 16l4-8 4 4 4-6" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground">Design Force</h1>
            <p className="text-[10px] font-medium text-primary/70">Client Report</p>
          </div>
        </div>
      )}

      {/* Report Title */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold text-foreground">{client.name}</h2>
        <p className="text-sm text-muted-foreground">
          {month} &mdash; Monthly Report
        </p>
      </div>

      {/* Task Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th
                  className="px-4 py-3 text-left font-semibold text-foreground cursor-pointer select-none hover:text-primary transition-colors"
                  onClick={() => handleSort("name")}
                >
                  Task Name
                  <SortIcon columnKey="name" />
                </th>
                {customFieldColumns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left font-semibold text-foreground cursor-pointer select-none hover:text-primary transition-colors"
                    onClick={() => handleSort(col)}
                  >
                    {col}
                    <SortIcon columnKey={col} />
                  </th>
                ))}
                <th
                  className="px-4 py-3 text-right font-semibold text-foreground cursor-pointer select-none hover:text-primary transition-colors"
                  onClick={() => handleSort("billable_time")}
                >
                  Billable Time
                  <SortIcon columnKey="billable_time" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + customFieldColumns.length}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No tasks found for this period.
                  </td>
                </tr>
              ) : (
                <>
                  {sortedTasks.map((task, i) => (
                    <tr
                      key={task.id}
                      className={`border-b border-border/50 ${i % 2 === 0 ? "bg-transparent" : "bg-muted/10"}`}
                    >
                      <td className="px-4 py-2.5 text-foreground">{task.name}</td>
                      {customFieldColumns.map((col) => {
                        const val = task.custom_fields[col];
                        const colors = val ? fieldColorMap[col]?.[val] : null;
                        return (
                          <td key={col} className="px-4 py-2.5">
                            {val ? (
                              <span
                                className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
                                  colors
                                    ? `${colors.bg} ${colors.text} ${colors.border}`
                                    : "bg-muted/20 text-muted-foreground border-border"
                                }`}
                              >
                                {val}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-foreground">
                        {task.billable_time != null ? task.billable_time : "—"}
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="border-t-2 border-primary/30 bg-primary/5">
                    <td
                      className="px-4 py-3 font-bold text-foreground"
                      colSpan={1 + customFieldColumns.length}
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                      {totalBillable}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <ReportSummary summary={summary} month={month} year={year} />
    </div>
  );
}

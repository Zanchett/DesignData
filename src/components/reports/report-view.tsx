"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ReportData } from "@/lib/report-utils";
import { ReportSummary } from "./report-summary";

type SortKey = "name" | "billable_time" | string;
type SortDir = "asc" | "desc";

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
                      {customFieldColumns.map((col) => (
                        <td key={col} className="px-4 py-2.5 text-muted-foreground">
                          {task.custom_fields[col] || "—"}
                        </td>
                      ))}
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

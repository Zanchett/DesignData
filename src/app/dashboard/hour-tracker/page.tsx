"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EditableCell } from "@/components/dashboard/editable-cell";
import { useHourTracker, useWeeklyBillable } from "@/hooks/use-analytics";
import { Download, Upload, RefreshCw, Undo2, Redo2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_KEYS = [
  "hours_jan", "hours_feb", "hours_mar",
  "hours_apr", "hours_may", "hours_jun",
  "hours_jul", "hours_aug", "hours_sep",
  "hours_oct", "hours_nov", "hours_dec",
] as const;

const MONTH_LABELS_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const MONTH_LABELS_FULL = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

// Fixed 48 weeks: W1-W4 = January, W5-W8 = February, etc.
const ALL_WEEKS = Array.from({ length: 48 }, (_, i) => i + 1);

function getMonthForWeek(w: number): number {
  return Math.ceil(w / 4) - 1; // 0-indexed month
}

const PLAN_OPTIONS = ["Monthly", "Annual"];
const PACKAGE_OPTIONS = ["Marketing Force", "Pro Force", "Full Force"];
const ACTIVITY_OPTIONS = ["Going", "Using Rollover", "Paused", "Terminated"];

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  Monthly: { bg: "bg-blue-500/15", text: "text-blue-400" },
  Annual: { bg: "bg-purple-500/15", text: "text-purple-400" },
};

const PACKAGE_COLORS: Record<string, { bg: string; text: string }> = {
  "Marketing Force": { bg: "bg-cyan-500/15", text: "text-cyan-400" },
  "Pro Force": { bg: "bg-amber-500/15", text: "text-amber-400" },
  "Full Force": { bg: "bg-indigo-500/15", text: "text-indigo-400" },
};

const ACTIVITY_COLORS: Record<string, { bg: string; text: string }> = {
  Going: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  "Using Rollover": { bg: "bg-amber-500/15", text: "text-amber-400" },
  Paused: { bg: "bg-zinc-500/15", text: "text-zinc-400" },
  Terminated: { bg: "bg-red-500/15", text: "text-red-400" },
};

const EDITABLE_FIELDS = [
  "project_manager", "contract_sign_date", "plan", "package", "activity",
  "rollover_2025", ...MONTH_KEYS,
] as const;

interface ContractRow {
  client_id: number;
  client_name: string;
  project_manager: string | null;
  contract_sign_date: string | null;
  plan: string | null;
  package: string | null;
  activity: string | null;
  rollover_2025: number | null;
  hours_jan: number;
  hours_feb: number;
  hours_mar: number;
  hours_apr: number;
  hours_may: number;
  hours_jun: number;
  hours_jul: number;
  hours_aug: number;
  hours_sep: number;
  hours_oct: number;
  hours_nov: number;
  hours_dec: number;
}

interface UndoEntry {
  clientId: number;
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
}

export default function HourTrackerPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data, isLoading, mutate } = useHourTracker();
  const { data: weeklyData, mutate: mutateWeekly } = useWeeklyBillable(year);
  const [saving, setSaving] = useState<string | null>(null);

  // Undo/Redo stacks
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  // Weekly sync controls
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const [syncMonth, setSyncMonth] = useState(currentMonth);
  const [syncWeek, setSyncWeek] = useState((currentMonth - 1) * 4 + 1);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const syncWeekOptions = useMemo(() => {
    const start = (syncMonth - 1) * 4 + 1;
    return [start, start + 1, start + 2, start + 3];
  }, [syncMonth]);

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows: ContractRow[] = data?.contracts || [];
  const weekly: Record<string, Record<string, number>> = weeklyData?.weekly || {};

  const handleSave = useCallback(
    async (clientId: number, field: string, value: string | number | null, oldValue?: string | number | null) => {
      setSaving(`${clientId}-${field}`);
      try {
        // Push to undo stack
        if (oldValue !== undefined) {
          setUndoStack((prev) => [...prev, { clientId, field, oldValue, newValue: value }]);
          setRedoStack([]); // clear redo on new edit
        }
        await fetch("/api/hour-tracker", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, field, value }),
        });
        mutate();
      } finally {
        setSaving(null);
      }
    },
    [mutate]
  );

  const handleUndo = useCallback(async () => {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, entry]);
    setSaving(`${entry.clientId}-${entry.field}`);
    try {
      await fetch("/api/hour-tracker", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: entry.clientId, field: entry.field, value: entry.oldValue }),
      });
      mutate();
    } finally {
      setSaving(null);
    }
  }, [undoStack, mutate]);

  const handleRedo = useCallback(async () => {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return;
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, entry]);
    setSaving(`${entry.clientId}-${entry.field}`);
    try {
      await fetch("/api/hour-tracker", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: entry.clientId, field: entry.field, value: entry.newValue }),
      });
      mutate();
    } finally {
      setSaving(null);
    }
  }, [redoStack, mutate]);

  const handleClearAll = useCallback(async () => {
    // Single bulk DELETE clears all contracts + weekly snapshots
    await fetch("/api/hour-tracker", { method: "DELETE" });
    setUndoStack([]);
    setRedoStack([]);
    mutate();
    mutateWeekly();
  }, [mutate, mutateWeekly]);

  const handleWeeklySave = useCallback(
    async (clientId: number, weekNum: number, value: string | number | null) => {
      const hours = Number(value) || 0;
      setSaving(`${clientId}-w${weekNum}`);
      try {
        await fetch("/api/hour-tracker/sync-weekly", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, week: weekNum, year, hours }),
        });
        mutateWeekly();
      } finally {
        setSaving(null);
      }
    },
    [year, mutateWeekly]
  );

  const handleSyncWeek = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/hour-tracker/sync-weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: syncMonth, week: syncWeek, year }),
      });
      const result = await res.json() as {
        ok?: boolean;
        error?: string;
        synced?: number;
        totalTasksFetched?: number;
        matchedTasks?: number;
        clientsWithHours?: number;
        month?: string;
      };
      if (!res.ok) {
        setSyncResult(`Sync failed: ${result.error}`);
      } else {
        setSyncResult(
          `Synced W${syncWeek}: ${result.totalTasksFetched} tasks fetched from ClickUp, ` +
          `${result.matchedTasks} matched ${result.month} ${year}, ` +
          `${result.synced} clients updated`
        );
        // Auto-clear after 8 seconds
        setTimeout(() => setSyncResult(null), 8000);
      }
      mutateWeekly();
    } catch (err) {
      setSyncResult(`Sync error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setSyncing(false);
    }
  }, [syncMonth, syncWeek, year, mutateWeekly]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { read, utils } = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = read(buffer);

      // Try to find the "Master Sheet" sheet, fall back to first sheet
      const sheetName = wb.SheetNames.find(
        (s) => s.toLowerCase().includes("master")
      ) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      // The Master Sheet has group headers in rows 1-2, actual headers in row 3.
      // Detect the correct header row by scanning for "Client" in column A.
      const range = utils.decode_range(ws["!ref"] || "A1");
      let headerRow = 0;
      for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
        const cell = ws[utils.encode_cell({ r, c: 0 })];
        if (cell && String(cell.v).toLowerCase() === "client") {
          headerRow = r;
          break;
        }
      }

      // Parse with the detected header row
      const jsonRows = utils.sheet_to_json<Record<string, unknown>>(ws, {
        range: headerRow,
      });

      // Build a flexible column name → field mapping (case-insensitive)
      const fieldMap: Record<string, string> = {};
      const addMapping = (keys: string[], field: string) => {
        keys.forEach((k) => { fieldMap[k.toLowerCase()] = field; });
      };

      addMapping(["PM", "Project Manager"], "project_manager");
      addMapping(["Contract Sign Date", "Sign Date"], "contract_sign_date");
      addMapping(["Plan"], "plan");
      addMapping(["Package"], "package");
      addMapping(["Activity"], "activity");
      addMapping([
        "Rollover", "ROLLOVER 2025", "ROLLOVER 2024",
        `Rollover ${year - 1}`, `ROLLOVER ${year - 1}`,
      ], "rollover_2025");

      // Month columns — support "JAN"/"FEB"/... and numeric "1"/"2"/... headers
      MONTH_LABELS_SHORT.forEach((label, i) => {
        fieldMap[label.toLowerCase()] = MONTH_KEYS[i];
        fieldMap[String(i + 1)] = MONTH_KEYS[i];
      });

      // Build a weekly column map: "w1" → 1, "w2" → 2, etc.
      const weeklyColMap: Record<string, number> = {};
      for (let w = 1; w <= 48; w++) {
        weeklyColMap[`w${w}`] = w;
      }

      // Map each row by client name and update matching fields
      for (const importRow of jsonRows) {
        const clientName = String(importRow["Client"] || importRow["client"] || "").trim();
        if (!clientName) continue;

        const match = rows.find(
          (r) => r.client_name.toLowerCase() === clientName.toLowerCase()
        );
        if (!match) continue;

        const contractUpdates: Promise<Response>[] = [];
        const weeklyUpdates: Promise<Response>[] = [];

        for (const [col, rawVal] of Object.entries(importRow)) {
          if (rawVal === undefined || rawVal === null || rawVal === "" || rawVal === "-") continue;
          // Skip Excel formula strings that weren't resolved to values
          if (typeof rawVal === "string" && rawVal.startsWith("=")) continue;

          // Check if it's a contract field
          const field = fieldMap[col.toLowerCase()];
          if (field) {
            let finalVal: string | number = typeof rawVal === "number" ? rawVal : String(rawVal);

            // Normalize date values for contract_sign_date
            // Spreadsheet uses MM-DD-YYYY (US standard), DB needs YYYY-MM-DD
            if (field === "contract_sign_date" && typeof finalVal === "string") {
              const sep = finalVal.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
              if (sep) {
                const yr = sep[3].length === 2 ? (parseInt(sep[3]) < 50 ? `20${sep[3]}` : `19${sep[3]}`) : sep[3];
                // If year is 4 digits and last part → MM-DD-YYYY or MM/DD/YYYY → YYYY-MM-DD
                finalVal = `${yr}-${sep[1].padStart(2, "0")}-${sep[2].padStart(2, "0")}`;
              }
              // YYYY-MM-DD is already correct for DB
            }

            contractUpdates.push(
              fetch("/api/hour-tracker", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: match.client_id, field, value: finalVal }),
              })
            );
            continue;
          }

          // Check if it's a weekly column (W1, W2, ..., W48)
          const weekNum = weeklyColMap[col.toLowerCase()];
          if (weekNum && typeof rawVal === "number" && rawVal > 0) {
            weeklyUpdates.push(
              fetch("/api/hour-tracker/sync-weekly", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  clientId: match.client_id,
                  week: weekNum,
                  year,
                  hours: rawVal,
                }),
              })
            );
          }
        }
        await Promise.all([...contractUpdates, ...weeklyUpdates]);
      }
      mutate();
      mutateWeekly();
    } catch (err) {
      console.error("Import failed:", err);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [rows, mutate, mutateWeekly, year]);

  const handleExport = useCallback(async () => {
    try {
      const { utils, writeFileXLSX } = await import("xlsx");

      const exportRows = rows.map((r) => {
        const monthlyTotal = MONTH_KEYS.reduce((sum, k) => sum + (r[k] || 0), 0);
        const clientWeekly = weekly[String(r.client_id)] || {};
        const hoursUsed = ALL_WEEKS.reduce((s, w) => s + (clientWeekly[String(w)] || 0), 0);

        const row: Record<string, unknown> = {
          Client: r.client_name,
          "Project Manager": r.project_manager || "",
          "Contract Sign Date": r.contract_sign_date
            ? (() => { const m = r.contract_sign_date.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[2]}-${m[3]}-${m[1]}` : r.contract_sign_date; })()
            : "",
          Plan: r.plan || "",
          Package: r.package || "",
          Activity: r.activity || "",
          [`Rollover ${year - 1}`]: r.rollover_2025 || 0,
        };

        MONTH_LABELS_SHORT.forEach((label, i) => {
          row[label] = r[MONTH_KEYS[i]] || 0;
        });
        row["TOTAL"] = monthlyTotal;

        ALL_WEEKS.forEach((w) => {
          row[`W${w}`] = clientWeekly[String(w)] || 0;
        });

        row["Hours Used"] = Math.round(hoursUsed * 10) / 10;
        row["Hours Left"] = Math.round((monthlyTotal - hoursUsed) * 10) / 10;
        row["Total Available"] = Math.round((monthlyTotal + (r.rollover_2025 || 0)) * 10) / 10;

        return row;
      });

      const ws = utils.json_to_sheet(exportRows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, `Hours ${year}`);
      writeFileXLSX(wb, `HourTracker_${year}.xlsx`);
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [rows, weekly, year]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  // Number of "info" columns before the month area
  const INFO_COL_COUNT = 7; // Client, PM, Sign Date, Plan, Package, Activity, Rollover

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Hour Tracker</h2>
          <p className="text-sm text-muted-foreground">
            Master sheet — {rows.length} clients
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)} className="text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sync Week Controls */}
          <div className="flex items-center gap-1.5 border-l border-border pl-2.5 ml-0.5">
            <Select
              value={String(syncMonth)}
              onValueChange={(v) => {
                const m = Number(v);
                setSyncMonth(m);
                setSyncWeek((m - 1) * 4 + 1);
              }}
            >
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_LABELS_SHORT.map((label, i) => (
                  <SelectItem key={i} value={String(i + 1)} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(syncWeek)}
              onValueChange={(v) => setSyncWeek(Number(v))}
            >
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {syncWeekOptions.map((w) => (
                  <SelectItem key={w} value={String(w)} className="text-xs">
                    W{w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleSyncWeek}
              disabled={syncing}
            >
              <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
              {syncing ? "Syncing..." : "Sync Week"}
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
          >
            <Undo2 className="h-3 w-3" />
            Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
          >
            <Redo2 className="h-3 w-3" />
            Redo
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => { mutate(); mutateWeekly(); }}
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>

          {/* Import XLSX */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3 w-3" />
            Import XLSX
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleExport}
          >
            <Download className="h-3 w-3" />
            Export XLSX
          </Button>

          {/* Clear All with confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all fields?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all editable fields (PM, plan, package, activity, rollover, and monthly hours) for every client. Weekly billable data from ClickUp will not be affected. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, clear everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className={cn(
          "rounded-lg border px-4 py-2.5 text-xs",
          syncResult.startsWith("Sync failed") || syncResult.startsWith("Sync error")
            ? "border-red-300 bg-red-500/10 text-red-400"
            : "border-green-300 bg-green-500/10 text-green-400"
        )}>
          {syncResult}
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[calc(100vh-200px)]">
            <table className="w-full text-xs border-collapse relative">
              <thead className="sticky top-0 z-20">
                {/* Row 1: Group headers */}
                <tr className="border-b bg-muted/30">
                  {/* Empty cells spanning the info columns */}
                  <th colSpan={INFO_COL_COUNT} className="sticky left-0 z-30 bg-muted/50 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]" />

                  {/* HOURS PURCHASED spanning months + total */}
                  <th
                    colSpan={13}
                    className="bg-blue-500/10 px-2 py-2 text-center font-bold text-blue-700 dark:text-blue-300 text-[11px] tracking-wider border-l border-border border-r-2 border-r-blue-300 dark:border-r-blue-700"
                  >
                    HOURS PURCHASED
                  </th>

                  {/* Month name headers over weekly columns (4 per month) */}
                  {MONTH_LABELS_FULL.map((month, i) => (
                    <th
                      key={month}
                      colSpan={4}
                      className="bg-amber-500/10 px-1 py-2 text-center font-bold text-amber-700 dark:text-amber-300 text-[10px] tracking-wider border-l-2 border-amber-300 dark:border-amber-700"
                    >
                      {month}
                    </th>
                  ))}

                  {/* Summary group */}
                  <th
                    colSpan={3}
                    className="bg-green-500/10 px-2 py-2 text-center font-bold text-green-700 dark:text-green-300 text-[11px] tracking-wider border-l-2 border-green-300 dark:border-green-700"
                  >
                    SUMMARY
                  </th>
                </tr>

                {/* Row 2: Column headers */}
                <tr className="border-b bg-muted/50">
                  {/* Fixed columns */}
                  <th className="sticky left-0 z-30 min-w-[180px] bg-muted/80 px-3 py-2.5 text-left font-semibold backdrop-blur-sm shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]">
                    Client
                  </th>
                  <th className="min-w-[120px] px-2 py-2.5 text-left font-medium">PM</th>
                  <th className="min-w-[100px] px-2 py-2.5 text-left font-medium">Sign Date</th>
                  <th className="min-w-[90px] px-2 py-2.5 text-left font-medium">Plan</th>
                  <th className="min-w-[100px] px-2 py-2.5 text-left font-medium">Package</th>
                  <th className="min-w-[100px] px-2 py-2.5 text-left font-medium">Activity</th>
                  <th className="min-w-[80px] px-2 py-2.5 text-right font-medium border-r border-border">Rollover</th>

                  {/* Monthly hours */}
                  {MONTH_LABELS_SHORT.map((m) => (
                    <th key={m} className="min-w-[60px] bg-blue-500/5 px-2 py-2.5 text-right font-medium border-l border-blue-100 dark:border-blue-900/30">
                      {m}
                    </th>
                  ))}
                  <th className="min-w-[70px] bg-blue-500/10 px-2 py-2.5 text-right font-semibold border-r-2 border-blue-300 dark:border-blue-700">
                    TOTAL
                  </th>

                  {/* Weekly columns - fixed 48 */}
                  {ALL_WEEKS.map((w) => {
                    const isMonthStart = (w - 1) % 4 === 0;
                    return (
                      <th
                        key={w}
                        className={cn(
                          "min-w-[50px] bg-amber-500/5 px-1.5 py-2.5 text-right font-medium text-[11px]",
                          isMonthStart && "border-l-2 border-amber-300 dark:border-amber-700"
                        )}
                      >
                        W{w}
                      </th>
                    );
                  })}

                  {/* Summary */}
                  <th className="min-w-[75px] bg-green-500/10 px-2 py-2.5 text-right font-medium border-l-2 border-green-300 dark:border-green-700">Used</th>
                  <th className="min-w-[75px] bg-green-500/10 px-2 py-2.5 text-right font-medium">Left</th>
                  <th className="min-w-[75px] bg-green-500/10 px-2 py-2.5 text-right font-medium">Available</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const monthlyTotal = MONTH_KEYS.reduce((sum, k) => sum + (row[k] || 0), 0);
                  const clientWeekly = weekly[String(row.client_id)] || {};
                  const hoursUsed = ALL_WEEKS.reduce((s, w) => s + (clientWeekly[String(w)] || 0), 0);
                  const hoursLeft = monthlyTotal - hoursUsed;
                  const totalAvailable = monthlyTotal + (row.rollover_2025 || 0);

                  return (
                    <tr key={row.client_id} className="border-b hover:bg-muted/40 transition-colors even:bg-muted/10">
                      {/* Fixed: Client name */}
                      <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]">
                        <span className="truncate block max-w-[170px]" title={row.client_name}>
                          {row.client_name}
                        </span>
                      </td>

                      {/* Editable: PM */}
                      <td className="px-1 py-1">
                        <EditableCell
                          value={row.project_manager}
                          field="project_manager"
                          onSave={(f, v) => handleSave(row.client_id, f, v, row.project_manager)}
                        />
                      </td>

                      {/* Editable: Sign Date */}
                      <td className="px-1 py-1">
                        <EditableCell
                          value={row.contract_sign_date}
                          field="contract_sign_date"
                          type="date"
                          onSave={(f, v) => handleSave(row.client_id, f, v, row.contract_sign_date)}
                        />
                      </td>

                      {/* Editable: Plan */}
                      <td className="px-1 py-1">
                        <EditableCell
                          value={row.plan}
                          field="plan"
                          type="select"
                          options={PLAN_OPTIONS}
                          colorMap={PLAN_COLORS}
                          onSave={(f, v) => handleSave(row.client_id, f, v, row.plan)}
                        />
                      </td>

                      {/* Editable: Package */}
                      <td className="px-1 py-1">
                        <EditableCell
                          value={row.package}
                          field="package"
                          type="select"
                          options={PACKAGE_OPTIONS}
                          colorMap={PACKAGE_COLORS}
                          onSave={(f, v) => handleSave(row.client_id, f, v, row.package)}
                        />
                      </td>

                      {/* Editable: Activity */}
                      <td className="px-1 py-1">
                        <EditableCell
                          value={row.activity}
                          field="activity"
                          type="select"
                          options={ACTIVITY_OPTIONS}
                          colorMap={ACTIVITY_COLORS}
                          onSave={(f, v) => handleSave(row.client_id, f, v, row.activity)}
                        />
                      </td>

                      {/* Editable: Rollover */}
                      <td className="px-1 py-1 text-right border-r border-border">
                        <EditableCell
                          value={row.rollover_2025}
                          field="rollover_2025"
                          type="number"
                          onSave={(f, v) => handleSave(row.client_id, f, v, row.rollover_2025)}
                          className="text-right"
                        />
                      </td>

                      {/* Monthly hours - editable */}
                      {MONTH_KEYS.map((key) => (
                        <td key={key} className="bg-blue-500/5 px-1 py-1 text-right border-l border-blue-100/50 dark:border-blue-900/20">
                          <EditableCell
                            value={row[key]}
                            field={key}
                            type="number"
                            onSave={(f, v) => handleSave(row.client_id, f, v, row[key])}
                            className="text-right"
                          />
                        </td>
                      ))}

                      {/* Monthly total - auto */}
                      <td className="bg-blue-500/10 px-2 py-1.5 text-right font-semibold font-mono border-r-2 border-blue-300 dark:border-blue-700">
                        {monthlyTotal > 0 ? monthlyTotal : "—"}
                      </td>

                      {/* Weekly - editable (fixed 48 weeks) */}
                      {ALL_WEEKS.map((w) => {
                        const val = clientWeekly[String(w)] || 0;
                        const isMonthStart = (w - 1) % 4 === 0;
                        return (
                          <td
                            key={w}
                            className={cn(
                              "bg-amber-500/5 px-1 py-1 text-right",
                              isMonthStart && "border-l-2 border-amber-300 dark:border-amber-700"
                            )}
                          >
                            <EditableCell
                              value={val > 0 ? val : null}
                              field={`w${w}`}
                              type="number"
                              onSave={(_f, v) => handleWeeklySave(row.client_id, w, v)}
                              className="text-right text-[11px]"
                            />
                          </td>
                        );
                      })}

                      {/* Summary - auto */}
                      <td className="bg-green-500/10 px-2 py-1.5 text-right font-mono font-medium border-l-2 border-green-300 dark:border-green-700">
                        {hoursUsed > 0 ? (Math.round(hoursUsed * 10) / 10) : "—"}
                      </td>
                      <td className={cn(
                        "bg-green-500/10 px-2 py-1.5 text-right font-mono font-medium",
                        hoursLeft < 0 && "text-red-400"
                      )}>
                        {monthlyTotal > 0 ? (Math.round(hoursLeft * 10) / 10) : "—"}
                      </td>
                      <td className="bg-green-500/10 px-2 py-1.5 text-right font-mono font-medium">
                        {totalAvailable > 0 ? (Math.round(totalAvailable * 10) / 10) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="flex h-32 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  No clients found. Run a sync first to populate client data.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

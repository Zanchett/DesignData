"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Zap,
  RefreshCw,
  Key,
  Hash,
  StopCircle,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useSyncStatus } from "@/hooks/use-analytics";
import { SYNC_STEPS } from "@/lib/constants";
import { format } from "date-fns";

export default function SettingsPage() {
  const [token, setToken] = useState("");
  const [teamId, setTeamId] = useState("");
  const [syncMonths, setSyncMonths] = useState("3");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    teamName?: string;
    error?: string;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState("");
  const [syncProgress, setSyncProgress] = useState("");
  const [saved, setSaved] = useState(false);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncLogIdRef = useRef<string | undefined>(undefined);
  const cancelledRef = useRef(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const { data: syncData, mutate: refreshSync } = useSyncStatus();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.clickup_token) setToken(data.clickup_token);
        if (data.team_id) setTeamId(data.team_id);
        if (data.sync_months) setSyncMonths(data.sync_months);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const body: Record<string, string> = {};
    if (token && !token.startsWith("••")) body.clickup_token = token;
    if (teamId) body.team_id = teamId;
    body.sync_months = syncMonths;

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const body: Record<string, string> = {};
    if (token && !token.startsWith("••")) body.clickup_token = token;
    body.action = "test";

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    setTestResult(result);
    setTesting(false);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    setSyncWarnings([]);
    cancelledRef.current = false;
    syncLogIdRef.current = undefined;

    const allWarnings: string[] = [];

    try {
      for (const step of SYNC_STEPS) {
        if (cancelledRef.current) break;

        setSyncStep(step);
        setSyncProgress("");
        let cursor: number | undefined;
        let chunkNum = 0;

        // Loop for chunked steps (tasks) that may need multiple calls
        do {
          if (cancelledRef.current) break;
          chunkNum++;

          if (cursor !== undefined) {
            setSyncProgress(`(batch ${chunkNum})`);
          }

          const res: Response = await fetch("/api/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              step,
              sync_log_id: syncLogIdRef.current,
              cursor,
            }),
          });
          const result = await res.json() as {
            error?: string;
            sync_log_id?: string;
            nextCursor?: number;
            warnings?: string[];
          };
          if (!res.ok) throw new Error(result.error);
          syncLogIdRef.current = result.sync_log_id;
          cursor = result.nextCursor;

          // Collect warnings
          if (result.warnings?.length) {
            allWarnings.push(...result.warnings);
            setSyncWarnings([...allWarnings]);
          }

          if (result.error === "Sync cancelled") break;
        } while (cursor !== undefined);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("Sync failed:", msg);
      setSyncError(msg);
    } finally {
      setSyncing(false);
      setSyncStep("");
      setSyncProgress("");
      syncLogIdRef.current = undefined;
      refreshSync();
    }
  }

  async function handleStopSync() {
    cancelledRef.current = true;
    if (syncLogIdRef.current) {
      await fetch("/api/sync/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_log_id: syncLogIdRef.current }),
      });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure your ClickUp connection and manage data sync
        </p>
      </div>

      {/* Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">ClickUp Connection</CardTitle>
          <CardDescription className="text-xs">
            Enter your ClickUp API token and Team ID. Find your token at ClickUp
            Settings → Apps → API Token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Key className="h-3 w-3" />
              API Token
            </label>
            <Input
              type="password"
              placeholder="pk_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Hash className="h-3 w-3" />
              Team ID
            </label>
            <Input
              placeholder="Your team/workspace ID"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Find at: ClickUp → Settings → Workspace. The number in the URL after /settings/
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <Button
              onClick={handleTest}
              disabled={testing}
              variant="outline"
              size="sm"
            >
              {testing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="mr-1.5 h-3.5 w-3.5" />
              )}
              Test Connection
            </Button>
          </div>

          {saved && (
            <p className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle2 className="h-3 w-3" /> Settings saved
            </p>
          )}
          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-xs ${
                testResult.ok
                  ? "bg-green-500/10 text-green-500"
                  : "bg-red-500/10 text-red-500"
              }`}
            >
              {testResult.ok ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Connected to workspace: {testResult.teamName}
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  {testResult.error}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Data Sync</CardTitle>
          <CardDescription className="text-xs">
            Pull latest data from ClickUp into the analytics database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sync date range */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Sync Range
            </label>
            <Select value={syncMonths} onValueChange={setSyncMonths}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 1 month</SelectItem>
                <SelectItem value="2">Last 2 months</SelectItem>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              How far back to pull tasks and time entries. Larger ranges take longer and use more API calls.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleSync} disabled={syncing} size="sm">
              {syncing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Syncing {syncStep} {syncProgress}...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Full Sync
                </>
              )}
            </Button>
            {syncing && (
              <Button
                onClick={handleStopSync}
                variant="destructive"
                size="sm"
              >
                <StopCircle className="mr-1.5 h-3.5 w-3.5" />
                Stop
              </Button>
            )}
          </div>

          {syncing && (
            <div className="space-y-2">
              {SYNC_STEPS.map((step) => {
                const currentIdx = SYNC_STEPS.indexOf(
                  syncStep as (typeof SYNC_STEPS)[number]
                );
                const stepIdx = SYNC_STEPS.indexOf(step);
                const isDone = stepIdx < currentIdx;
                const isCurrent = step === syncStep;

                return (
                  <div
                    key={step}
                    className="flex items-center gap-2 text-xs"
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : isCurrent ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30" />
                    )}
                    <span
                      className={
                        isDone
                          ? "text-green-500"
                          : isCurrent
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }
                    >
                      {step.replace("_", " ")}
                      {isCurrent && syncProgress ? ` ${syncProgress}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sync Error */}
          {syncError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-red-500">
                <XCircle className="h-3.5 w-3.5" />
                Sync Failed
              </div>
              <p className="text-xs text-red-400">{syncError}</p>
            </div>
          )}

          {/* Sync Warnings (shown during and after sync) */}
          {syncWarnings.length > 0 && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-yellow-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                {syncWarnings.length} warning{syncWarnings.length !== 1 ? "s" : ""} during sync
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {syncWarnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-yellow-400/80 font-mono leading-relaxed">
                    • {w}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Sync History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="text-right">Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(syncData?.history || []).map(
                (log: {
                  id: string;
                  status: string;
                  started_at: string;
                  records_synced: number;
                  error_message?: string;
                }) => (
                  <>
                    <TableRow
                      key={log.id}
                      className={log.error_message ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={() =>
                        log.error_message &&
                        setExpandedLog(expandedLog === log.id ? null : log.id)
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {log.error_message && (
                            expandedLog === log.id ? (
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )
                          )}
                          <Badge
                            variant={
                              log.status === "completed"
                                ? "default"
                                : log.status === "failed" || log.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {log.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(log.started_at), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {log.records_synced}
                      </TableCell>
                    </TableRow>
                    {expandedLog === log.id && log.error_message && (
                      <TableRow key={`${log.id}-error`}>
                        <TableCell colSpan={3} className="bg-red-500/5 border-t-0">
                          <div className="rounded-md bg-red-500/10 p-2.5">
                            <p className="text-[11px] font-mono text-red-400 break-all whitespace-pre-wrap">
                              {log.error_message}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              )}
              {(!syncData?.history || syncData.history.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-xs text-muted-foreground"
                  >
                    No sync history yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

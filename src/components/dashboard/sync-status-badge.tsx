"use client";

import { useState } from "react";
import { RefreshCw, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSyncStatus } from "@/hooks/use-analytics";
import { SYNC_STEPS } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";

export function SyncStatusBadge() {
  const { data, mutate } = useSyncStatus();
  const [syncing, setSyncing] = useState(false);
  const [currentStep, setCurrentStep] = useState("");

  const latest = data?.latest;
  const isRunning = latest?.status === "running" || syncing;

  const lastSyncText = latest?.completed_at
    ? formatDistanceToNow(new Date(latest.completed_at), { addSuffix: true })
    : "Never";

  async function runSync() {
    setSyncing(true);
    let logId: string | undefined;

    try {
      for (const step of SYNC_STEPS) {
        setCurrentStep(step);
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step, sync_log_id: logId }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        logId = result.sync_log_id;
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
      setCurrentStep("");
      mutate();
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isRunning ? (
        <Badge variant="secondary" className="gap-1.5 text-xs font-normal">
          <Loader2 className="h-3 w-3 animate-spin" />
          Syncing {currentStep}...
        </Badge>
      ) : latest?.status === "failed" ? (
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="destructive" className="gap-1.5 text-xs font-normal">
              <AlertCircle className="h-3 w-3" />
              Sync failed
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{latest.error_message}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Badge variant="secondary" className="gap-1.5 text-xs font-normal">
          <Check className="h-3 w-3 text-green-500" />
          Synced {lastSyncText}
        </Badge>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={runSync}
            disabled={isRunning}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRunning ? "animate-spin" : ""}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Sync now</TooltipContent>
      </Tooltip>
    </div>
  );
}

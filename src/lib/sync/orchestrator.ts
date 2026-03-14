import { SupabaseClient } from "@supabase/supabase-js";
import { ClickUpClient } from "@/lib/clickup/client";
import { syncMembers } from "./sync-members";
import { syncFolders } from "./sync-folders";
import { syncLists } from "./sync-lists";
import { syncTasks } from "./sync-tasks";
import { syncTimeEntries } from "./sync-time-entries";
import { DEFAULT_SYNC_MONTHS, type SyncStep } from "@/lib/constants";

// Process this many lists per API call to stay within Vercel's timeout
const LISTS_PER_CHUNK = 15;

export interface SyncResult {
  step: SyncStep;
  recordsSynced: number;
  error?: string;
  warnings?: string[];
  /** If set, the client should call this step again with this cursor */
  nextCursor?: number;
}

async function getSettings(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["clickup_token", "team_id", "sync_months"]);

  const settings: Record<string, string> = {};
  data?.forEach((row) => {
    settings[row.key] = row.value;
  });
  return settings;
}

export async function runSyncStep(
  supabase: SupabaseClient,
  step: SyncStep,
  syncLogId?: string,
  cursor?: number
): Promise<SyncResult> {
  // Check if sync was cancelled
  if (syncLogId) {
    const { data: logCheck } = await supabase
      .from("sync_log")
      .select("status")
      .eq("id", syncLogId)
      .single();
    if (logCheck?.status === "cancelled") {
      return { step, recordsSynced: 0, error: "Sync cancelled" };
    }
  }

  const settings = await getSettings(supabase);
  const token = settings.clickup_token;
  const teamId = settings.team_id;
  const syncMonths = parseInt(settings.sync_months || String(DEFAULT_SYNC_MONTHS));

  if (!token || !teamId) {
    throw new Error("ClickUp API token and Team ID must be configured in Settings");
  }

  const clickup = new ClickUpClient(token);

  // Calculate sync date boundary
  const syncStartDate = Date.now() - syncMonths * 30 * 24 * 60 * 60 * 1000;

  // Update sync log step
  if (syncLogId) {
    await supabase
      .from("sync_log")
      .update({ current_step: step })
      .eq("id", syncLogId);
  }

  let recordsSynced = 0;

  switch (step) {
    case "members":
      recordsSynced = await syncMembers(clickup, supabase, teamId);
      break;

    case "folders": {
      const { count } = await syncFolders(clickup, supabase, teamId);
      recordsSynced = count;
      break;
    }

    case "lists":
      recordsSynced = await syncLists(clickup, supabase);
      break;

    case "tasks": {
      // Chunked: process LISTS_PER_CHUNK lists at a time
      const result = await syncTasks(clickup, supabase, {
        dateUpdatedGt: syncStartDate,
        listOffset: cursor || 0,
        listLimit: LISTS_PER_CHUNK,
      });
      recordsSynced = result.tasksSynced;

      // If there are more lists to process, return a cursor
      if (result.hasMore) {
        return {
          step,
          recordsSynced,
          warnings: result.warnings,
          nextCursor: result.nextOffset,
        };
      }

      return {
        step,
        recordsSynced,
        warnings: result.warnings,
      };
    }

    case "time_entries":
      recordsSynced = await syncTimeEntries(clickup, supabase, teamId, {
        startDate: syncStartDate,
      });
      break;

    case "finalize":
      await supabase.rpc("refresh_analytics_views");
      recordsSynced = 0;
      break;
  }

  return { step, recordsSynced };
}

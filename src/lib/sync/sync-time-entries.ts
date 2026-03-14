import { ClickUpClient } from "@/lib/clickup/client";
import { SupabaseClient } from "@supabase/supabase-js";

export async function syncTimeEntries(
  clickup: ClickUpClient,
  supabase: SupabaseClient,
  teamId: string,
  options?: { startDate?: number }
): Promise<number> {
  // Default: last 90 days if no start date
  const startDate = options?.startDate || Date.now() - 90 * 24 * 60 * 60 * 1000;
  const endDate = Date.now();

  // Get all designers to fetch their time entries
  const { data: designers, error: dErr } = await supabase
    .from("designers")
    .select("id")
    .eq("is_active", true);
  if (dErr) throw dErr;

  // Build a lookup of task -> folder_id
  const { data: taskFolders } = await supabase
    .from("tasks")
    .select("id, folder_id");
  const taskFolderMap = new Map(
    (taskFolders || []).map((t) => [t.id, t.folder_id])
  );

  // Build set of known task IDs for FK safety
  const knownTaskIds = new Set(taskFolderMap.keys());

  let totalEntries = 0;

  // Fetch time entries for all assignees
  const assigneeIds = designers?.map((d) => String(d.id)).join(",") || "";

  if (!assigneeIds) return 0;

  let entries;
  try {
    entries = await clickup.getTimeEntries(teamId, {
      startDate,
      endDate,
      assignee: assigneeIds,
    });
  } catch (err) {
    console.warn(`[SYNC] Time entries API error: ${err instanceof Error ? err.message : err}`);
    throw err;
  }

  if (entries.length === 0) return 0;

  const entryRows = entries.map((e) => {
    // Only link task_id if the task exists in our DB (avoid FK violation)
    const taskId = e.task?.id && knownTaskIds.has(e.task.id) ? e.task.id : null;

    return {
      id: e.id,
      task_id: taskId,
      designer_id: e.user.id,
      duration: parseInt(e.duration),
      start_timestamp: new Date(parseInt(e.start)).toISOString(),
      end_timestamp: new Date(parseInt(e.end)).toISOString(),
      description: e.description,
      tags: e.tags,
      billable: e.billable,
      folder_id: taskId ? (taskFolderMap.get(taskId) || null) : null,
      raw_data: e,
      synced_at: new Date().toISOString(),
    };
  });

  // Batch upsert in chunks of 500
  for (let i = 0; i < entryRows.length; i += 500) {
    const chunk = entryRows.slice(i, i + 500);
    const { error } = await supabase
      .from("time_entries")
      .upsert(chunk, { onConflict: "id" });
    if (error) throw error;
  }

  totalEntries = entries.length;
  return totalEntries;
}

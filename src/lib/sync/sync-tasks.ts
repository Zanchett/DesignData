import { ClickUpClient } from "@/lib/clickup/client";
import { SupabaseClient } from "@supabase/supabase-js";
import { isCompletedStatus, BILLABLE_TIME_FIELD_ID, MONTH_FIELD_NAME } from "@/lib/constants";
import type { ClickUpCustomField } from "@/lib/clickup/types";

export function extractBillableTime(customFields?: ClickUpCustomField[]): number | null {
  if (!customFields) return null;
  const field = customFields.find((f) => f.id === BILLABLE_TIME_FIELD_ID);
  if (!field || field.value === null || field.value === undefined || field.value === "") return null;
  const val = Number(field.value);
  return isNaN(val) ? null : val;
}

export function extractBillableMonth(customFields?: ClickUpCustomField[]): string | null {
  if (!customFields) return null;
  const field = customFields.find((f) => f.name?.includes("Month"));
  if (!field || field.value === null || field.value === undefined) return null;
  // value is the orderindex of the selected option
  const orderIndex = Number(field.value);
  if (isNaN(orderIndex) || !field.type_config?.options) return null;
  const option = field.type_config.options.find((o) => o.orderindex === orderIndex);
  return option?.name || null;
}

export interface SyncTasksResult {
  tasksSynced: number;
  hasMore: boolean;
  nextOffset: number;
  warnings: string[];
}

export async function syncTasks(
  clickup: ClickUpClient,
  supabase: SupabaseClient,
  options?: {
    dateUpdatedGt?: number;
    listOffset?: number;
    listLimit?: number;
  }
): Promise<SyncTasksResult> {
  const { data: lists, error: listsError } = await supabase
    .from("lists")
    .select("id, folder_id")
    .order("id");
  if (listsError) throw listsError;
  if (!lists?.length) return { tasksSynced: 0, hasMore: false, nextOffset: 0, warnings: [] };

  const offset = options?.listOffset || 0;
  const limit = options?.listLimit || lists.length;
  const chunk = lists.slice(offset, offset + limit);
  const hasMore = offset + limit < lists.length;
  const nextOffset = offset + limit;

  // Get all known designer IDs to check for missing assignees
  const { data: knownDesigners } = await supabase
    .from("designers")
    .select("id");
  const knownIds = new Set((knownDesigners || []).map((d) => d.id));

  let totalTasks = 0;
  const warnings: string[] = [];

  for (const list of chunk) {
    let tasks;
    try {
      tasks = await clickup.getAllTasks(String(list.id), {
        includesClosed: true,
        dateUpdatedGt: options?.dateUpdatedGt,
      });
    } catch (err) {
      // Skip lists that return ClickUp API errors (deleted/archived lists, internal errors like ITEM_122)
      const msg = `Skipped list ${list.id} (folder ${list.folder_id}): ${err instanceof Error ? err.message : err}`;
      console.warn(`[SYNC] ${msg}`);
      warnings.push(msg);
      continue;
    }

    if (tasks.length === 0) continue;

    // Upsert tasks
    const taskRows = tasks.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description?.substring(0, 500) || null,
      status: t.status.status,
      status_type: isCompletedStatus(t.status.status) ? "done" : "active",
      list_id: list.id,
      folder_id: list.folder_id,
      date_created: t.date_created ? new Date(parseInt(t.date_created)).toISOString() : null,
      date_updated: t.date_updated ? new Date(parseInt(t.date_updated)).toISOString() : null,
      date_closed: t.date_closed ? new Date(parseInt(t.date_closed)).toISOString() : null,
      date_done: t.date_done ? new Date(parseInt(t.date_done)).toISOString() : null,
      due_date: t.due_date ? new Date(parseInt(t.due_date)).toISOString() : null,
      start_date: t.start_date ? new Date(parseInt(t.start_date)).toISOString() : null,
      time_estimate: t.time_estimate,
      time_spent: t.time_spent,
      priority: t.priority ? parseInt(t.priority.id) : null,
      tags: t.tags,
      parent_task_id: t.parent || null,
      billable_time: extractBillableTime(t.custom_fields),
      billable_month: extractBillableMonth(t.custom_fields),
      raw_data: t,
      synced_at: new Date().toISOString(),
    }));

    // Batch upsert tasks in chunks of 50
    for (let i = 0; i < taskRows.length; i += 50) {
      const batch = taskRows.slice(i, i + 50);
      try {
        const { error: taskError } = await supabase
          .from("tasks")
          .upsert(batch, { onConflict: "id" });
        if (taskError) {
          const msg = `Failed to upsert tasks for list ${list.id}: ${taskError.message}`;
          console.warn(`[SYNC] ${msg}`);
          warnings.push(msg);
          continue;
        }
      } catch (err) {
        const msg = `Error upserting tasks for list ${list.id}: ${err instanceof Error ? err.message : err}`;
        console.warn(`[SYNC] ${msg}`);
        warnings.push(msg);
        continue;
      }
    }

    // Collect all assignees and ensure they exist in designers table
    const allAssignees = tasks.flatMap((t) => t.assignees);
    const missingDesigners = allAssignees.filter((a) => !knownIds.has(a.id));

    if (missingDesigners.length > 0) {
      // Create unique missing designers (deactivated users, guests, etc.)
      const uniqueMissing = new Map<number, typeof missingDesigners[0]>();
      missingDesigners.forEach((a) => uniqueMissing.set(a.id, a));

      const missingRows = Array.from(uniqueMissing.values()).map((a) => ({
        id: a.id,
        username: a.username || `User ${a.id}`,
        email: a.email || null,
        color: a.color || null,
        profile_picture: a.profilePicture || null,
        is_active: false,
        raw_data: a,
        synced_at: new Date().toISOString(),
      }));

      const { error: insertErr } = await supabase
        .from("designers")
        .upsert(missingRows, { onConflict: "id" });
      if (insertErr) {
        warnings.push(`Failed to upsert designers: ${insertErr.message}`);
      }

      missingRows.forEach((r) => knownIds.add(r.id));
    }

    // Upsert task assignees
    const assigneeRows = tasks.flatMap((t) =>
      t.assignees.map((a) => ({
        task_id: t.id,
        designer_id: a.id,
      }))
    );

    if (assigneeRows.length > 0) {
      try {
        const taskIds = tasks.map((t) => t.id);
        await supabase.from("task_assignees").delete().in("task_id", taskIds);

        const { error: assigneeError } = await supabase
          .from("task_assignees")
          .upsert(assigneeRows, { onConflict: "task_id,designer_id" });
        if (assigneeError) {
          warnings.push(`Failed to upsert assignees for list ${list.id}: ${assigneeError.message}`);
        }
      } catch (err) {
        warnings.push(`Assignee sync error for list ${list.id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    totalTasks += tasks.length;
  }

  return {
    tasksSynced: totalTasks,
    hasMore,
    nextOffset,
    warnings,
  };
}

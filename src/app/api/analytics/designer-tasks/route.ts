import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/analytics/designer-tasks?designerId=123&startDate=...&endDate=...
 *
 * Returns all tasks assigned to a designer within the date range,
 * grouped by client, sorted by tracked hours descending.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const designerId = searchParams.get("designerId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!designerId) {
    return NextResponse.json(
      { error: "designerId is required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Get all tasks assigned to this designer within the date range
  let query = supabase
    .from("task_assignees")
    .select(`
      task_id,
      tasks!inner (
        id,
        name,
        status,
        folder_id,
        date_created,
        billable_time,
        billable_month,
        parent_task_id
      )
    `)
    .eq("designer_id", Number(designerId));

  const { data: assignedTasks, error: assignErr } = await query;

  if (assignErr) {
    return NextResponse.json({ error: assignErr.message }, { status: 500 });
  }

  // Get time entries for this designer to compute tracked hours per task
  let timeQuery = supabase
    .from("time_entries")
    .select("task_id, duration")
    .eq("designer_id", Number(designerId));

  if (startDate) {
    timeQuery = timeQuery.gte("start", startDate);
  }
  if (endDate) {
    timeQuery = timeQuery.lte("start", endDate);
  }

  const { data: timeEntries, error: timeErr } = await timeQuery;

  if (timeErr) {
    return NextResponse.json({ error: timeErr.message }, { status: 500 });
  }

  // Aggregate tracked hours per task
  const trackedByTask: Record<string, number> = {};
  for (const te of timeEntries || []) {
    const tid = String(te.task_id);
    trackedByTask[tid] = (trackedByTask[tid] || 0) + (Number(te.duration) || 0);
  }

  // Get client names
  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, name");

  const clientNameMap: Record<number, string> = {};
  for (const c of clientRows || []) {
    clientNameMap[Number(c.id)] = c.name;
  }

  // Build task list with tracked hours, filter by date range
  interface TaskRow {
    task_id: string;
    task_name: string;
    status: string;
    client_name: string;
    tracked_hours: number;
    billable_hours: number | null;
  }

  const tasks: TaskRow[] = [];

  for (const at of assignedTasks || []) {
    const t = at.tasks as unknown as {
      id: string;
      name: string;
      status: string;
      folder_id: number;
      date_created: string;
      billable_time: number | null;
      billable_month: string | null;
      parent_task_id: string | null;
    };

    // Skip subtasks
    if (t.parent_task_id) continue;

    // Filter by date range (using date_created)
    if (startDate && t.date_created && t.date_created < startDate) continue;
    if (endDate && t.date_created && t.date_created > endDate) continue;

    const trackedMs = trackedByTask[String(t.id)] || 0;
    const trackedHours = Math.round((trackedMs / 3600000) * 10) / 10;

    // Only include tasks that have tracked time or billable time
    if (trackedHours <= 0 && (!t.billable_time || t.billable_time <= 0)) continue;

    tasks.push({
      task_id: String(t.id),
      task_name: t.name,
      status: t.status,
      client_name: clientNameMap[Number(t.folder_id)] || "Unknown",
      tracked_hours: trackedHours,
      billable_hours: t.billable_time ? Math.round(t.billable_time * 10) / 10 : null,
    });
  }

  // Sort by tracked hours descending
  tasks.sort((a, b) => b.tracked_hours - a.tracked_hours);

  // Compute totals
  const totalTracked = Math.round(tasks.reduce((s, t) => s + t.tracked_hours, 0) * 10) / 10;
  const totalBillable = Math.round(
    tasks.reduce((s, t) => s + (t.billable_hours || 0), 0) * 10
  ) / 10;

  return NextResponse.json({
    tasks,
    totalTracked,
    totalBillable,
    taskCount: tasks.length,
  });
}

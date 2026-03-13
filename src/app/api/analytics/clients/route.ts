import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isMonthInRange } from "@/lib/billable-month-utils";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const metric = searchParams.get("metric") || "tracked";

  const supabase = createServerClient();

  const { data, error } = await supabase.rpc("get_client_metrics", {
    p_start_date: startDate || null,
    p_end_date: endDate || null,
    p_metric: metric,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Per-client designer breakdown — dual mode
  let clientDesignerMap: Record<string, Record<string, { hours: number; designer_id: number }>> = {};

  if (metric === "billable") {
    // Query parent tasks' billable_time grouped by folder (client) and designer
    // Filter by billable_month, not date_created. billable_time is already in hours.
    const { data: taskData } = await supabase
      .from("tasks")
      .select("folder_id, designer_id, billable_time, billable_month, designers(username)")
      .is("parent_task_id", null)
      .not("billable_month", "is", null);

    (taskData || []).forEach((t: Record<string, unknown>) => {
      if (!t.folder_id) return;
      // Filter by billable_month matching the date range
      if (startDate || endDate) {
        if (!t.billable_month || !isMonthInRange(t.billable_month as string, startDate, endDate)) return;
      }
      const clientId = String(t.folder_id);
      const designerName =
        (t.designers as { username: string } | null)?.username || "Unknown";
      const designerId = (t.designer_id as number) || 0;
      if (!clientDesignerMap[clientId]) clientDesignerMap[clientId] = {};
      if (!clientDesignerMap[clientId][designerName]) {
        clientDesignerMap[clientId][designerName] = { hours: 0, designer_id: designerId };
      }
      // billable_time is already in hours, accumulate raw (round at output)
      clientDesignerMap[clientId][designerName].hours +=
        (t.billable_time as number) || 0;
    });
  } else {
    // Query time_entries (tracked mode)
    let teQuery = supabase
      .from("time_entries")
      .select("folder_id, designer_id, duration, designers(username)");
    if (startDate) teQuery = teQuery.gte("start_timestamp", startDate);
    if (endDate) teQuery = teQuery.lte("start_timestamp", endDate);
    const { data: timeData } = await teQuery;

    (timeData || []).forEach((te: Record<string, unknown>) => {
      if (!te.folder_id) return;
      const clientId = String(te.folder_id);
      const designerName =
        (te.designers as { username: string } | null)?.username || "Unknown";
      const designerId = (te.designer_id as number) || 0;
      if (!clientDesignerMap[clientId]) clientDesignerMap[clientId] = {};
      if (!clientDesignerMap[clientId][designerName]) {
        clientDesignerMap[clientId][designerName] = { hours: 0, designer_id: designerId };
      }
      // Accumulate raw ms, convert at output
      clientDesignerMap[clientId][designerName].hours +=
        (te.duration as number) || 0;
    });
  }

  // Transform into two maps: breakdown (name→hours) and idMap (name→designer_id)
  const clientDesignerBreakdown: Record<string, Record<string, number>> = {};
  const clientDesignerIdMap: Record<string, Record<string, number>> = {};

  Object.entries(clientDesignerMap).forEach(([clientId, designers]) => {
    clientDesignerBreakdown[clientId] = {};
    clientDesignerIdMap[clientId] = {};
    Object.entries(designers).forEach(([name, info]) => {
      // For tracked mode, hours are stored as raw ms — convert to hours and round
      // For billable mode, hours are already in hours — just round
      const hours = metric === "billable"
        ? Math.round(info.hours * 10) / 10
        : Math.round((info.hours / 3600000) * 10) / 10;
      clientDesignerBreakdown[clientId][name] = hours;
      clientDesignerIdMap[clientId][name] = info.designer_id;
    });
  });

  return NextResponse.json({
    clients: data || [],
    clientDesignerBreakdown,
    clientDesignerIdMap,
  });
}

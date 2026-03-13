import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isMonthInRange } from "@/lib/billable-month-utils";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const metric = searchParams.get("metric") || "tracked";

  const supabase = createServerClient();

  // Total hours — dual mode
  let totalHours = 0;
  if (metric === "billable") {
    // Sum billable_time from parent tasks — filter by billable_month, not date_created
    // billable_time is already in hours (from the custom field), no ms conversion needed
    let billableQuery = supabase
      .from("tasks")
      .select("billable_time, billable_month")
      .is("parent_task_id", null)
      .not("billable_month", "is", null);

    // Filter by month range derived from start/end dates
    if (startDate || endDate) {
      const { data: allBillable } = await billableQuery;
      const filteredTasks = (allBillable || []).filter((t) => {
        if (!t.billable_month) return false;
        return isMonthInRange(t.billable_month as string, startDate, endDate);
      });
      totalHours = Math.round(
        filteredTasks.reduce((sum, t) => sum + ((t.billable_time as number) || 0), 0) * 10
      ) / 10;
    } else {
      const { data: billableData } = await billableQuery;
      totalHours = Math.round(
        ((billableData || []).reduce((sum, t) => sum + ((t.billable_time as number) || 0), 0)) * 10
      ) / 10;
    }
  } else {
    // Sum duration from time_entries (tracked)
    let timeQuery = supabase.from("time_entries").select("duration");
    if (startDate) timeQuery = timeQuery.gte("start_timestamp", startDate);
    if (endDate) timeQuery = timeQuery.lte("start_timestamp", endDate);
    const { data: timeData } = await timeQuery;
    totalHours =
      Math.round(
        ((timeData || []).reduce((sum, t) => sum + (t.duration || 0), 0) / 3600000) * 10
      ) / 10;
  }

  // Tasks
  let taskQuery = supabase.from("tasks").select("id, status");
  if (startDate) taskQuery = taskQuery.gte("date_created", startDate);
  if (endDate) taskQuery = taskQuery.lte("date_created", endDate);
  const { data: taskData } = await taskQuery;
  const totalTasks = taskData?.length || 0;
  const completedTasks = (taskData || []).filter(
    (t) => ["for client review", "closed"].includes(t.status.toLowerCase())
  ).length;

  // Active designers
  const { data: designerData } = await supabase
    .from("designers")
    .select("id")
    .eq("is_active", true);
  const activeDesigners = designerData?.length || 0;

  // Active clients
  const { data: clientData } = await supabase
    .from("clients")
    .select("id")
    .eq("hidden", false);
  const activeClients = clientData?.length || 0;

  // Status distribution
  const statusCounts: Record<string, number> = {};
  (taskData || []).forEach((t) => {
    const s = t.status.toLowerCase();
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  // Top 5 designers by hours
  const { data: topDesigners } = await supabase.rpc("get_designer_metrics", {
    p_start_date: startDate || null,
    p_end_date: endDate || null,
    p_metric: metric,
  });

  return NextResponse.json({
    totalHours,
    totalTasks,
    completedTasks,
    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    activeDesigners,
    activeClients,
    statusDistribution: statusCounts,
    topDesigners: (topDesigners || []).slice(0, 5),
  });
}

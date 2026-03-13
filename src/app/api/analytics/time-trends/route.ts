import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const granularity = searchParams.get("granularity") || "week";
  const metric = searchParams.get("metric") || "tracked";

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Time trends
  const { data: trends, error: trendsError } = await supabase.rpc("get_time_trends", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_granularity: granularity,
    p_metric: metric,
  });

  if (trendsError) {
    return NextResponse.json({ error: trendsError.message }, { status: 500 });
  }

  // Workload distribution
  const { data: workload, error: workloadError } = await supabase.rpc(
    "get_workload_distribution",
    {
      p_start_date: startDate,
      p_end_date: endDate,
      p_granularity: granularity,
      p_metric: metric,
    }
  );

  if (workloadError) {
    return NextResponse.json({ error: workloadError.message }, { status: 500 });
  }

  return NextResponse.json({
    trends: trends || [],
    workload: workload || [],
  });
}

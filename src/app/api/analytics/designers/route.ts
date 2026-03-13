import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const metric = searchParams.get("metric") || "tracked";

  const supabase = createServerClient();

  const { data, error } = await supabase.rpc("get_designer_metrics", {
    p_start_date: startDate || null,
    p_end_date: endDate || null,
    p_metric: metric,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ designers: data || [] });
}

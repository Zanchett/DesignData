import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("weekly_hour_snapshots")
    .select("client_id, week_number, hours")
    .eq("year", year);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform into { [clientId]: { [weekNum]: hours } }
  const weeklyData: Record<string, Record<string, number>> = {};
  for (const row of data || []) {
    const clientId = String(row.client_id);
    const weekNum = String(row.week_number);
    if (!weeklyData[clientId]) weeklyData[clientId] = {};
    weeklyData[clientId][weekNum] = Number(row.hours);
  }

  return NextResponse.json({ weekly: weeklyData });
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const designerId = searchParams.get("designerId");
  const clientId = searchParams.get("clientId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!designerId || !clientId) {
    return NextResponse.json(
      { error: "designerId and clientId are required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data, error } = await supabase.rpc("get_designer_client_detail", {
    p_designer_id: Number(designerId),
    p_client_id: Number(clientId),
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data || [] });
}

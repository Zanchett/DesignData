import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sync_log_id } = body;

  if (!sync_log_id) {
    return NextResponse.json({ error: "sync_log_id is required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from("sync_log")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
      error_message: "Cancelled by user",
    })
    .eq("id", sync_log_id)
    .eq("status", "running");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

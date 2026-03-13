import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { runSyncStep } from "@/lib/sync/orchestrator";
import { SYNC_STEPS, type SyncStep } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { step, sync_log_id } = body as { step: SyncStep; sync_log_id?: string };

  if (!step || !SYNC_STEPS.includes(step)) {
    return NextResponse.json(
      { error: `Invalid step. Must be one of: ${SYNC_STEPS.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Create or use existing sync log
  let logId = sync_log_id;
  if (!logId && step === "members") {
    const { data: log, error: logError } = await supabase
      .from("sync_log")
      .insert({
        sync_type: "full",
        status: "running",
        current_step: step,
      })
      .select("id")
      .single();
    if (logError) throw logError;
    logId = log.id;
  }

  try {
    const result = await runSyncStep(supabase, step, logId);

    // Update records count
    if (logId) {
      const { data: existing } = await supabase
        .from("sync_log")
        .select("records_synced")
        .eq("id", logId)
        .single();

      await supabase
        .from("sync_log")
        .update({
          records_synced: (existing?.records_synced || 0) + result.recordsSynced,
          current_step: step,
          ...(step === "finalize"
            ? { status: "completed", completed_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", logId);
    }

    return NextResponse.json({
      ...result,
      sync_log_id: logId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (logId) {
      await supabase
        .from("sync_log")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    console.error(`[SYNC ERROR] Step: ${step}`, error);
    return NextResponse.json({ error: message, sync_log_id: logId }, { status: 500 });
  }
}

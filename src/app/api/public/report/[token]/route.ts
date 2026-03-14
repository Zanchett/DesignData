import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { computeReportData } from "@/lib/report-utils";

/**
 * GET: Public endpoint to fetch report data via share token.
 * No authentication required — token-based access.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServerClient();

  // Look up the share link
  const { data: share, error: shareError } = await supabase
    .from("report_shares")
    .select("client_id, month, year, expires_at, is_active")
    .eq("share_token", token)
    .single();

  if (shareError || !share) {
    return NextResponse.json(
      { error: "Report not found or link is invalid" },
      { status: 404 }
    );
  }

  if (!share.is_active) {
    return NextResponse.json(
      { error: "This report link has been deactivated" },
      { status: 410 }
    );
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This report link has expired" },
      { status: 410 }
    );
  }

  try {
    const report = await computeReportData(
      supabase,
      share.client_id,
      share.month,
      share.year
    );
    return NextResponse.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

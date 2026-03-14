import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * DELETE: Deactivate a share link.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from("report_shares")
    .update({ is_active: false })
    .eq("id", shareId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

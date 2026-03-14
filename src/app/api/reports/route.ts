import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET: List all clients (with contracts) and existing share links.
 */
export async function GET() {
  const supabase = createServerClient();

  const [clientsResult, sharesResult] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name")
      .eq("hidden", false)
      .order("name"),
    supabase
      .from("report_shares")
      .select("id, share_token, client_id, month, year, created_at, expires_at, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  if (clientsResult.error) {
    return NextResponse.json({ error: clientsResult.error.message }, { status: 500 });
  }

  // Get contracts for context
  const { data: contracts } = await supabase
    .from("client_contracts")
    .select("client_id, plan, package, activity");

  const contractMap = new Map(
    (contracts || []).map((c) => [c.client_id, c])
  );

  const clients = (clientsResult.data || []).map((c) => ({
    id: c.id,
    name: c.name,
    ...(contractMap.get(c.id) || {}),
  }));

  // Map client names to shares
  const clientNameMap = new Map(
    (clientsResult.data || []).map((c) => [c.id, c.name])
  );

  const shares = (sharesResult.data || []).map((s) => ({
    ...s,
    client_name: clientNameMap.get(s.client_id) || "Unknown",
  }));

  return NextResponse.json({ clients, shares });
}

/**
 * POST: Create a new share link for a client report.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();
  const { clientId, month, year } = body;

  if (!clientId || !month || !year) {
    return NextResponse.json(
      { error: "clientId, month, and year are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("report_shares")
    .insert({
      client_id: clientId,
      month,
      year,
    })
    .select("id, share_token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    shareId: data.id,
    shareToken: data.share_token,
  });
}

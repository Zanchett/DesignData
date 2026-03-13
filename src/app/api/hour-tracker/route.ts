import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();

  // Fetch all clients
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name")
    .order("name");

  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 });
  }

  // Fetch all client contracts
  const { data: contracts, error: contractsError } = await supabase
    .from("client_contracts")
    .select("*");

  if (contractsError) {
    return NextResponse.json({ error: contractsError.message }, { status: 500 });
  }

  // Map contracts by client_id
  const contractMap = new Map(
    (contracts || []).map((c) => [c.client_id, c])
  );

  // Merge clients with their contracts into flat rows
  const result = (clients || []).map((client) => {
    const contract = contractMap.get(client.id) || {};
    return {
      client_id: client.id,
      client_name: client.name,
      project_manager: contract.project_manager || null,
      contract_sign_date: contract.contract_sign_date || null,
      plan: contract.plan || null,
      package: contract.package || null,
      activity: contract.activity || null,
      rollover_2025: contract.rollover_2025 || 0,
      hours_jan: contract.hours_jan || 0,
      hours_feb: contract.hours_feb || 0,
      hours_mar: contract.hours_mar || 0,
      hours_apr: contract.hours_apr || 0,
      hours_may: contract.hours_may || 0,
      hours_jun: contract.hours_jun || 0,
      hours_jul: contract.hours_jul || 0,
      hours_aug: contract.hours_aug || 0,
      hours_sep: contract.hours_sep || 0,
      hours_oct: contract.hours_oct || 0,
      hours_nov: contract.hours_nov || 0,
      hours_dec: contract.hours_dec || 0,
    };
  });

  return NextResponse.json({ contracts: result });
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerClient();

  const body = await request.json();
  const { clientId, field, value } = body;
  const client_id = clientId;

  if (!client_id || !field) {
    return NextResponse.json(
      { error: "client_id and field are required" },
      { status: 400 }
    );
  }

  // Check if contract row exists
  const { data: existing } = await supabase
    .from("client_contracts")
    .select("id")
    .eq("client_id", client_id)
    .single();

  if (!existing) {
    // Create the row first
    const { error: insertError } = await supabase
      .from("client_contracts")
      .insert({ client_id, [field]: value });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  } else {
    // Update the existing row
    const { error: updateError } = await supabase
      .from("client_contracts")
      .update({ [field]: value })
      .eq("client_id", client_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE: Clear all hour tracker data (contracts + weekly snapshots).
 */
export async function DELETE() {
  const supabase = createServerClient();

  // Reset all editable fields on client_contracts in one query
  const { error: contractErr } = await supabase
    .from("client_contracts")
    .update({
      project_manager: null,
      contract_sign_date: null,
      plan: null,
      package: null,
      activity: null,
      rollover_2025: 0,
      hours_jan: 0,
      hours_feb: 0,
      hours_mar: 0,
      hours_apr: 0,
      hours_may: 0,
      hours_jun: 0,
      hours_jul: 0,
      hours_aug: 0,
      hours_sep: 0,
      hours_oct: 0,
      hours_nov: 0,
      hours_dec: 0,
    })
    .gte("client_id", 0); // match all rows

  if (contractErr) {
    return NextResponse.json({ error: contractErr.message }, { status: 500 });
  }

  // Delete all weekly snapshots
  const { error: weeklyErr } = await supabase
    .from("weekly_hour_snapshots")
    .delete()
    .gte("year", 0); // match all rows

  if (weeklyErr) {
    return NextResponse.json({ error: weeklyErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

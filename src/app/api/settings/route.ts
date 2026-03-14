import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ClickUpClient } from "@/lib/clickup/client";

export async function GET() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["clickup_token", "team_id", "sync_months"]);

  const settings: Record<string, string> = {};
  data?.forEach((row) => {
    if (row.key === "clickup_token") {
      settings[row.key] = row.value ? "••••••" + row.value.slice(-6) : "";
    } else {
      settings[row.key] = row.value;
    }
  });

  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { clickup_token, team_id, sync_months, action } = body;

  const supabase = createServerClient();

  if (action === "test") {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", "clickup_token")
      .single();

    const token = (clickup_token || data?.value || "").trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: "No token configured" }, { status: 400 });
    }

    const client = new ClickUpClient(token);
    const result = await client.testConnection();
    return NextResponse.json(result);
  }

  // Save settings
  const upserts = [];
  if (clickup_token) {
    upserts.push({
      key: "clickup_token",
      value: clickup_token.trim(),
      updated_at: new Date().toISOString(),
    });
  }
  if (team_id) {
    upserts.push({
      key: "team_id",
      value: team_id,
      updated_at: new Date().toISOString(),
    });
  }
  if (sync_months) {
    upserts.push({
      key: "sync_months",
      value: sync_months,
      updated_at: new Date().toISOString(),
    });
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from("app_settings")
      .upsert(upserts, { onConflict: "key" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

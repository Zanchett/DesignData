import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasSrk = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const srkPrefix = process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) || "MISSING";

  let dbCheck = "not tested";
  let tokenCheck = "not tested";
  let tokenLength = 0;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["clickup_token", "team_id"]);

    if (error) {
      dbCheck = `error: ${error.message}`;
    } else {
      dbCheck = `ok, ${data?.length || 0} rows`;
      const tokenRow = data?.find((r) => r.key === "clickup_token");
      if (tokenRow?.value) {
        tokenLength = tokenRow.value.length;
        tokenCheck = `found, length=${tokenLength}, prefix=${tokenRow.value.substring(0, 6)}`;
      } else {
        tokenCheck = "missing or empty";
      }
    }
  } catch (e) {
    dbCheck = `exception: ${e instanceof Error ? e.message : e}`;
  }

  return NextResponse.json({
    env: { hasUrl, hasAnon, hasSrk, srkPrefix },
    db: dbCheck,
    token: tokenCheck,
    tokenLength,
  });
}

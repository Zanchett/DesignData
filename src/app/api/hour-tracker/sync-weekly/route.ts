import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ClickUpClient } from "@/lib/clickup/client";
import { extractBillableTime, extractBillableMonth } from "@/lib/sync/sync-tasks";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { month, week, year } = body as {
    month: number;
    week: number;
    year: number;
  };

  // Validate inputs
  if (!month || !week || !year) {
    return NextResponse.json(
      { error: "month, week, and year are required" },
      { status: 400 }
    );
  }

  const monthStartWeek = (month - 1) * 4 + 1;
  const monthEndWeek = month * 4;

  if (week < monthStartWeek || week > monthEndWeek) {
    return NextResponse.json(
      { error: `Week ${week} does not belong to month ${month}. Expected W${monthStartWeek}-W${monthEndWeek}.` },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // 1. Get ClickUp API token
  const { data: tokenRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "clickup_token")
    .single();

  if (!tokenRow?.value) {
    return NextResponse.json(
      { error: "ClickUp API token not configured. Go to Settings first." },
      { status: 400 }
    );
  }

  const clickup = new ClickUpClient(tokenRow.value);

  // 2. Get all clients (folders) from the DB
  const { data: clients, error: clientsErr } = await supabase
    .from("clients")
    .select("id, name");

  if (clientsErr) {
    return NextResponse.json({ error: clientsErr.message }, { status: 500 });
  }

  const nameMap: Record<number, string> = {};
  for (const c of clients || []) {
    nameMap[Number(c.id)] = c.name;
  }

  // Helper: run async tasks with concurrency limit
  async function parallelLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
  ): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = [];
    for (let i = 0; i < items.length; i += limit) {
      const batch = items.slice(i, i + limit);
      const batchResults = await Promise.allSettled(batch.map(fn));
      results.push(...batchResults);
    }
    return results;
  }

  const CLIENT_COMM_NAME = "client communication";
  const billableMonthStr = `${MONTH_NAMES[month - 1]} ${year}`;
  const clientTotals: Record<number, number> = {};
  const seenTaskIds = new Set<string>();
  let totalTasksFetched = 0;
  let matchedTasks = 0;
  let listsScanned = 0;

  // Phase 1: Find "Client Communication" list IDs in parallel (10 at a time)
  const clientCommListMap: Record<number, string> = {}; // folderId → listId

  await parallelLimit(clients || [], 10, async (client) => {
    const folderId = Number(client.id);
    const folderLists = await clickup.getLists(String(folderId));
    const clientCommList = folderLists.find(
      (l) => l.name.toLowerCase() === CLIENT_COMM_NAME
    );
    if (clientCommList) {
      clientCommListMap[folderId] = clientCommList.id;
    }
  });

  // Phase 2: Fetch tasks from those lists in parallel (10 at a time)
  const listEntries = Object.entries(clientCommListMap);
  listsScanned = listEntries.length;

  await parallelLimit(listEntries, 10, async ([folderIdStr, listId]) => {
    const folderId = Number(folderIdStr);
    const tasks = await clickup.getAllTasks(listId, {
      includesClosed: true,
    });
    totalTasksFetched += tasks.length;

    for (const t of tasks) {
      if (t.parent || seenTaskIds.has(t.id)) continue;
      seenTaskIds.add(t.id);

      const bMonth = extractBillableMonth(t.custom_fields);
      if (bMonth !== billableMonthStr) continue;

      const bTime = extractBillableTime(t.custom_fields);
      if (!bTime || bTime <= 0) continue;

      matchedTasks++;
      clientTotals[folderId] = (clientTotals[folderId] || 0) + bTime;
    }
  });

  // 5. Get sum of hours already synced in prior weeks of this month
  const { data: existingSnapshots, error: snapErr } = await supabase
    .from("weekly_hour_snapshots")
    .select("client_id, hours")
    .eq("year", year)
    .gte("week_number", monthStartWeek)
    .lt("week_number", week);

  if (snapErr) {
    return NextResponse.json({ error: snapErr.message }, { status: 500 });
  }

  const previousTotals: Record<number, number> = {};
  for (const s of existingSnapshots || []) {
    const cid = Number(s.client_id);
    previousTotals[cid] = (previousTotals[cid] || 0) + Number(s.hours);
  }

  // 6. Build upsert rows: incremental = total - previous (clamped to 0)
  const upserts = (clients || [])
    .map((c) => {
      const cid = Number(c.id);
      const total = clientTotals[cid] || 0;
      const previous = previousTotals[cid] || 0;
      const incremental = Math.max(0, Math.round((total - previous) * 10) / 10);
      return {
        client_id: cid,
        year,
        week_number: week,
        hours: incremental,
        synced_at: new Date().toISOString(),
      };
    })
    .filter((row) => row.hours > 0);

  if (upserts.length > 0) {
    const { error: upsertErr } = await supabase
      .from("weekly_hour_snapshots")
      .upsert(upserts, { onConflict: "client_id,year,week_number" });

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }
  }

  // 7. Build debug summary for the response
  const details = (clients || [])
    .map((c) => {
      const cid = Number(c.id);
      const total = clientTotals[cid] || 0;
      const previous = previousTotals[cid] || 0;
      if (total > 0 || previous > 0) {
        return {
          name: nameMap[cid] || String(cid),
          total: Math.round(total * 10) / 10,
          previous: Math.round(previous * 10) / 10,
          incremental: Math.max(0, Math.round((total - previous) * 10) / 10),
        };
      }
      return null;
    })
    .filter(Boolean);

  return NextResponse.json({
    ok: true,
    synced: upserts.length,
    month: MONTH_NAMES[month - 1],
    week,
    year,
    billableMonthQuery: billableMonthStr,
    listsScanned,
    totalTasksFetched,
    matchedTasks,
    clientsWithHours: Object.keys(clientTotals).length,
    details,
  });
}

/**
 * PATCH: Manually set a single weekly hour value for a client.
 * Body: { clientId: number, week: number, year: number, hours: number }
 */
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { clientId, week, year, hours } = body as {
    clientId: number;
    week: number;
    year: number;
    hours: number;
  };

  if (!clientId || !week || !year || hours === undefined) {
    return NextResponse.json(
      { error: "clientId, week, year, and hours are required" },
      { status: 400 }
    );
  }

  if (week < 1 || week > 48) {
    return NextResponse.json(
      { error: "week must be between 1 and 48" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const numHours = Math.round(Number(hours) * 10) / 10;

  if (numHours <= 0) {
    // Delete the row if hours is 0 or negative
    await supabase
      .from("weekly_hour_snapshots")
      .delete()
      .eq("client_id", clientId)
      .eq("year", year)
      .eq("week_number", week);
  } else {
    const { error } = await supabase
      .from("weekly_hour_snapshots")
      .upsert(
        {
          client_id: clientId,
          year,
          week_number: week,
          hours: numHours,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "client_id,year,week_number" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

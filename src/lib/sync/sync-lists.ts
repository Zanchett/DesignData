import { ClickUpClient } from "@/lib/clickup/client";
import { SupabaseClient } from "@supabase/supabase-js";
import { INTERNAL_LIST_NAME } from "@/lib/constants";

export async function syncLists(
  clickup: ClickUpClient,
  supabase: SupabaseClient
): Promise<number> {
  // Get all client folders from DB
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id")
    .order("id");
  if (clientsError) throw clientsError;
  if (!clients?.length) return 0;

  let totalLists = 0;

  for (const client of clients) {
    const lists = await clickup.getLists(String(client.id));

    // Only include internal communication lists
    const internalLists = lists.filter(
      (l) => l.name.toLowerCase() === INTERNAL_LIST_NAME.toLowerCase()
    );

    const listRows = internalLists.map((l) => ({
      id: parseInt(l.id),
      name: l.name,
      folder_id: client.id,
      list_type: "internal_comms",
      task_count: parseInt(l.task_count) || 0,
      raw_data: l,
      synced_at: new Date().toISOString(),
    }));

    if (listRows.length > 0) {
      const { error } = await supabase
        .from("lists")
        .upsert(listRows, { onConflict: "id" });
      if (error) throw error;
      totalLists += listRows.length;
    }
  }

  return totalLists;
}

import { ClickUpClient } from "@/lib/clickup/client";
import { SupabaseClient } from "@supabase/supabase-js";

export async function syncFolders(
  clickup: ClickUpClient,
  supabase: SupabaseClient,
  teamId: string
): Promise<{ count: number; spaceId: string }> {
  const spaces = await clickup.getSpaces(teamId);
  if (spaces.length === 0) throw new Error("No spaces found");

  // Use first space (main space)
  const space = spaces[0];
  const folders = await clickup.getFolders(space.id);

  const clients = folders.map((f) => ({
    id: parseInt(f.id),
    name: f.name,
    space_id: parseInt(space.id),
    hidden: f.hidden,
    task_count: parseInt(f.task_count) || 0,
    raw_data: f,
    synced_at: new Date().toISOString(),
  }));

  if (clients.length > 0) {
    const { error } = await supabase
      .from("clients")
      .upsert(clients, { onConflict: "id" });
    if (error) throw error;
  }

  // Store space_id for subsequent steps
  await supabase
    .from("app_settings")
    .upsert({ key: "space_id", value: space.id, updated_at: new Date().toISOString() }, { onConflict: "key" });

  return { count: clients.length, spaceId: space.id };
}

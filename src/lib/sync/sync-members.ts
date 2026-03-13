import { ClickUpClient } from "@/lib/clickup/client";
import { SupabaseClient } from "@supabase/supabase-js";
import { DESIGNER_EMAIL_DOMAIN } from "@/lib/constants";

export async function syncMembers(
  clickup: ClickUpClient,
  supabase: SupabaseClient,
  teamId: string
): Promise<number> {
  const teams = await clickup.getTeams();
  const team = teams.find((t) => t.id === teamId);
  if (!team) throw new Error(`Team ${teamId} not found`);

  const members = team.members.map((m) => {
    const email = m.user.email?.toLowerCase() || "";
    const isDesigner = email.endsWith(DESIGNER_EMAIL_DOMAIN);

    return {
      id: m.user.id,
      username: m.user.username,
      email: m.user.email,
      color: m.user.color,
      profile_picture: m.user.profilePicture,
      is_active: isDesigner,
      raw_data: m.user,
      synced_at: new Date().toISOString(),
    };
  });

  if (members.length > 0) {
    const { error } = await supabase
      .from("designers")
      .upsert(members, { onConflict: "id" });
    if (error) throw error;
  }

  const designerCount = members.filter((m) => m.is_active).length;
  return designerCount;
}

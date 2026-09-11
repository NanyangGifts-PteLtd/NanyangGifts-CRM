import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type SystemLabel = { id: string; value: string };

export async function getSystemLabel(
  groupCode: string,
  systemKey: string,
): Promise<SystemLabel> {
  const { data, error } = await supabaseAdmin
    .from("option_values")
    .select("id, value, option_groups!inner(code)")
    .eq("system_key", systemKey)
    .eq("option_groups.code", groupCode)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      `Required system label ${groupCode}.${systemKey} is not configured. Run the system-label migration and verify the option exists.`,
    );
  }
  return { id: data.id, value: data.value };
}

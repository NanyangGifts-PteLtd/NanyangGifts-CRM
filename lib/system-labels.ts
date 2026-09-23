import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type SystemLabel = { id: string; value: string };

function systemKeyCandidates(groupCode: string, systemKey: string) {
  const prefix = `${groupCode}_`;
  const unprefixed = systemKey.startsWith(prefix)
    ? systemKey.slice(prefix.length)
    : systemKey;
  const prefixed = systemKey.startsWith(prefix)
    ? systemKey
    : `${prefix}${systemKey}`;
  return [...new Set([systemKey, unprefixed, prefixed])];
}

export async function getSystemLabel(
  groupCode: string,
  systemKey: string,
): Promise<SystemLabel> {
  const { data, error } = await supabaseAdmin
    .from("option_values")
    .select("id, value, system_key, option_groups!inner(code)")
    .in("system_key", systemKeyCandidates(groupCode, systemKey))
    .eq("option_groups.code", groupCode);

  if (error) throw new Error(error.message);
  const exact = (data ?? []).find((option) => option.system_key === systemKey);
  const fallback = (data ?? [])[0];
  const option = exact ?? fallback;
  if (!option) {
    throw new Error(
      `Required system label ${groupCode}.${systemKey} is not configured. Run the system-label migration and verify the option exists.`,
    );
  }
  return { id: option.id, value: option.value };
}

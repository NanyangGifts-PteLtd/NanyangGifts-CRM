import type { SupabaseClient } from "@supabase/supabase-js";

const CLIENT_WIDE_EDIT_ROLES = new Set(["admin", "director", "dev"]);

/**
 * Server-side counterpart to the CRM Board's client edit rule.
 *
 * API routes must enforce this themselves: a hidden button or an RLS policy is
 * not a sufficient authorization boundary for a route that can affect a
 * client, its quotes, or its order-confirmation forms.
 */
export async function canEditClient(
  supabase: SupabaseClient,
  clientId: string,
  userId: string,
) {
  const [
    { data: profile, error: profileError },
    { data: assignment, error: assignmentError },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("client_assignees")
      .select("user_id")
      .eq("client_id", clientId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (profileError || assignmentError) {
    throw profileError ?? assignmentError;
  }

  return (
    CLIENT_WIDE_EDIT_ROLES.has(String(profile?.role ?? "").toLowerCase()) ||
    Boolean(assignment)
  );
}

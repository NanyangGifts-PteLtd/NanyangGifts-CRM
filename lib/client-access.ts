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
    { data: client, error: clientError },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("client_assignees")
      .select("user_id")
      .eq("client_id", clientId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (profileError || assignmentError || clientError) {
    throw profileError ?? assignmentError ?? clientError;
  }

  return (
    Boolean(client) &&
    (CLIENT_WIDE_EDIT_ROLES.has(String(profile?.role ?? "").toLowerCase()) ||
      Boolean(assignment))
  );
}

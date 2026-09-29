// for supplier view only
import "server-only";
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Server workflows that perform authorised writes must use the service-role
 * key. An anon/publishable key can look valid at startup but will later fail
 * with a misleading RLS error after an external action (such as creating a
 * QuickBooks Bill) has already succeeded.
 */
export function assertSupabaseAdminConfiguration() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
  }

  const payload = key.split(".")[1];
  if (!payload) {
    throw new Error(
      "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not a valid service-role key.",
    );
  }

  try {
    const normalizedPayload = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const claims = JSON.parse(
      Buffer.from(normalizedPayload, "base64").toString("utf8"),
    ) as { role?: unknown };
    if (claims.role !== "service_role") throw new Error("wrong role");
  } catch {
    throw new Error(
      "Server configuration error: SUPABASE_SERVICE_ROLE_KEY must be the Supabase service_role key, not the publishable or anon key.",
    );
  }
}

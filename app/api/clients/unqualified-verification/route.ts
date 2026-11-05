import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const REVIEWER_ROLES = new Set(["admin", "director", "dev"]);

async function authorizeReviewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !REVIEWER_ROLES.has(String(profile?.role ?? "").trim().toLowerCase()))
    throw new Error("Forbidden");
  return user;
}

function failure(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Could not update Unqualified Lead verification.";
  return NextResponse.json(
    { error: message },
    { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400 },
  );
}

async function unqualifiedGroupId() {
  const { data, error } = await supabaseAdmin
    .from("crm_groups")
    .select("id")
    .ilike("name", "Unqualified Lead")
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    await authorizeReviewer();
    if (new URL(request.url).searchParams.get("summary") !== "count")
      throw new Error("Unsupported request");

    const groupId = await unqualifiedGroupId();
    if (!groupId) return NextResponse.json({ pendingCount: 0 });
    const { count, error } = await supabaseAdmin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .eq("unqualified_verified", false)
      .is("deleted_at", null);
    if (error) throw error;
    return NextResponse.json({ pendingCount: count ?? 0 });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await authorizeReviewer();
    const body = (await request.json()) as {
      clientId?: unknown;
      clientIds?: unknown;
      verified?: unknown;
    };
    const clientIds = [
      ...(typeof body.clientId === "string" ? [body.clientId] : []),
      ...(Array.isArray(body.clientIds)
        ? body.clientIds.filter((value): value is string => typeof value === "string")
        : []),
    ].map((id) => id.trim()).filter(Boolean);
    const uniqueClientIds = [...new Set(clientIds)];
    if (!uniqueClientIds.length || typeof body.verified !== "boolean")
      throw new Error("A client and verification value are required.");

    const groupId = await unqualifiedGroupId();
    if (!groupId) throw new Error("The Unqualified Lead group is not configured.");
    const { data, error } = await supabaseAdmin
      .from("clients")
      .update({ unqualified_verified: body.verified })
      .in("id", uniqueClientIds)
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .select("id, unqualified_verified")
      ;
    if (error) throw error;
    if (!data?.length) throw new Error("This client is not an active Unqualified Lead.");
    return NextResponse.json({
      verified: body.verified,
      clientIds: data.map((client) => client.id),
    });
  } catch (error) {
    return failure(error);
  }
}

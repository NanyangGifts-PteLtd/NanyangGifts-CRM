import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);
const MANAGER_ROLES = new Set(["admin", "director", "dev"]);

async function currentRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // The caller is authenticated with their own session above, but this role
  // lookup must not depend on the browser-facing profiles RLS policy.  A
  // filtered profile read otherwise makes authorised managers look forbidden
  // and the UI restores the previous round-robin layout after every edit.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role?.trim().toLowerCase() ?? "";
  return INTERNAL_ROLES.has(role) ? role : null;
}

export async function GET() {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [queueResult, pointerResult, layoutResult, membersResult] = await Promise.all([
    supabaseAdmin.rpc("get_sales_round_robin_queue"),
    supabaseAdmin.rpc("get_sales_round_robin_pointer"),
    supabaseAdmin.from("sales_round_robin_pool").select("user_id, position, is_active, list_name").order("position"),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, avatar_url, role")
      .in("role", ["sales", "director"])
      .order("full_name", { ascending: true, nullsFirst: true }),
  ]);
  if (queueResult.error || pointerResult.error || layoutResult.error || membersResult.error) {
    return NextResponse.json({ error: queueResult.error?.message ?? pointerResult.error?.message ?? layoutResult.error?.message ?? membersResult.error?.message ?? "Could not load round robin." }, { status: 500 });
  }
  const queueById = new Map((queueResult.data ?? []).map((row: { user_id: string }) => [row.user_id, row]));
  const queue = (layoutResult.data ?? []).map((row) => ({ ...row, ...(queueById.get(row.user_id) ?? {}) }));
  return NextResponse.json({
    queue,
    pointer: Number(pointerResult.data ?? 0),
    canEdit: MANAGER_ROLES.has(role),
    members: membersResult.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // These database functions use auth.uid() for their own permission check.
  // Invoke them with the caller's session, not the service role (whose
  // auth.uid() is null), after the server-side role check above has passed.
  const caller = await createClient();
  const body = await request.json() as { action?: string; layout?: unknown; position?: number; firstUserId?: string; secondUserId?: string; userId?: string; isActive?: boolean };
  if (body.action === "get-next") {
    const { data, error } = await supabaseAdmin.rpc("get_next_sales_assignee");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ next: data?.[0] ?? null });
  }
  if (!MANAGER_ROLES.has(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let error: { message: string } | null = null;
  if (body.action === "save-layout" && Array.isArray(body.layout)) {
    ({ error } = await caller.rpc("save_sales_round_robin_layout", { layout: body.layout }));
  } else if (body.action === "set-pointer" && Number.isInteger(body.position)) {
    ({ error } = await caller.rpc("set_sales_round_robin_pointer", { new_position: body.position }));
  } else if (body.action === "swap" && body.firstUserId && body.secondUserId) {
    ({ error } = await caller.rpc("swap_sales_round_robin_positions", { first_user_id: body.firstUserId, second_user_id: body.secondUserId }));
  } else if (body.action === "set-active" && body.userId && typeof body.isActive === "boolean") {
    ({ error } = await supabaseAdmin.from("sales_round_robin_pool").update({ is_active: body.isActive }).eq("user_id", body.userId));
  } else {
    return NextResponse.json({ error: "Invalid round-robin action." }, { status: 400 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

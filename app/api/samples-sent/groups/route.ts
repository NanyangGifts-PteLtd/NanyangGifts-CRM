import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const GROUP_MANAGER_ROLES = new Set(["director", "admin", "dev"]);

type Group = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  const role = String(profile?.role ?? "").toLowerCase();
  return { user, canManage: GROUP_MANAGER_ROLES.has(role) };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Samples Sent group request failed";
  const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const { canManage } = await authorize();
    const { data, error } = await supabaseAdmin
      .from("samples_sent_groups")
      .select("id, name, color, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ groups: (data ?? []) as Group[], canManage });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, canManage } = await authorize();
    if (!canManage) throw new Error("Forbidden");

    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    if (!name) throw new Error("Enter a group name.");
    if (name.length > 80) throw new Error("Group names can be at most 80 characters.");

    const { data: lastGroup, error: lastGroupError } = await supabaseAdmin
      .from("samples_sent_groups")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastGroupError) throw lastGroupError;

    const { data, error } = await supabaseAdmin
      .from("samples_sent_groups")
      .insert({
        name,
        color: "#9B6BD1",
        sort_order: Number(lastGroup?.sort_order ?? -1) + 1,
        created_by: user.id,
      })
      .select("id, name, color, sort_order")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("A group with this name already exists.");
      throw error;
    }
    return NextResponse.json({ group: data as Group });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { canManage } = await authorize();
    if (!canManage) throw new Error("Forbidden");

    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) throw new Error("A group is required.");

    const { error } = await supabaseAdmin
      .from("samples_sent_groups")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

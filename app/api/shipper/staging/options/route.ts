import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(); if (!profile?.role || !["pm", "director", "dev"].includes(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const shipperId = request.nextUrl.searchParams.get("shipperId"); if (!shipperId) return NextResponse.json({ error: "shipperId is required" }, { status: 400 });
  const { data: subitems, error } = await supabaseAdmin.from("subitems").select("id, name, client_id, cn_tracking, position").order("client_id").order("position"); if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const clientIds = [...new Set((subitems ?? []).map((item) => item.client_id).filter(Boolean))];
  const { data: clients } = clientIds.length ? await supabaseAdmin.from("clients").select("id, name, group_id, custom_fields, created_at").in("id", clientIds).order("created_at", { ascending: false }) : { data: [] };
  const [{ data: clientAssignments }, { data: subitemAssignments }] = await Promise.all([
    clientIds.length ? supabaseAdmin.from("client_assignees").select("client_id").eq("user_id", user.id).in("client_id", clientIds) : Promise.resolve({ data: [] }),
    (subitems ?? []).length ? supabaseAdmin.from("subitem_assignees").select("subitem_id").eq("user_id", user.id).in("subitem_id", (subitems ?? []).map((item) => item.id)) : Promise.resolve({ data: [] }),
  ]);
  const assignedClientIds = new Set((clientAssignments ?? []).map((row) => row.client_id));
  const assignedSubitemIds = new Set((subitemAssignments ?? []).map((row) => row.subitem_id));
  const pmClientIds = new Set((clients ?? []).filter((client) => { try { const ids = JSON.parse(client.custom_fields?.pmAssigneeIds ?? "[]"); return Array.isArray(ids) && ids.includes(user.id); } catch { return false; } }).map((client) => client.id));
  const withPermission = (item: { id: string; name: string; client_id: string | null; cn_tracking: string | null }) => ({ ...item, canPush: assignedSubitemIds.has(item.id) || (!!item.client_id && (assignedClientIds.has(item.client_id) || pmClientIds.has(item.client_id))) });
  const groupIds = [...new Set((clients ?? []).map((client) => client.group_id).filter(Boolean))];
  const { data: groups } = groupIds.length ? await supabaseAdmin.from("crm_groups").select("id, name, sort_order").in("id", groupIds).order("sort_order") : { data: [] };
  const priority = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (normalized === "shortlisted") return 0;
    if (normalized === "follow up") return 1;
    return 2;
  };
  const orderedGroups = [...(groups ?? [])].sort((first, second) => priority(first.name) - priority(second.name) || first.sort_order - second.sort_order);
  return NextResponse.json({ groups: orderedGroups.map((group) => ({ id: group.id, name: group.name, clients: (clients ?? []).filter((client) => client.group_id === group.id).map((client) => ({ id: client.id, name: client.name, subitems: (subitems ?? []).filter((item) => item.client_id === client.id).map(withPermission) })) })), ungrouped: (clients ?? []).filter((client) => !client.group_id).map((client) => ({ id: client.id, name: client.name, subitems: (subitems ?? []).filter((item) => item.client_id === client.id).map(withPermission) })) });
}

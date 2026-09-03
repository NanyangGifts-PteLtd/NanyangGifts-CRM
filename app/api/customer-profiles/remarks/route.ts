import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role?.toLowerCase() ?? "";
  if (!["sales", "pm", "admin", "director", "dev"].includes(role)) return null;
  return { user, role };
}

function parentColumn(type: string) {
  return type === "client" ? "client_profile_id" : type === "company" ? "company_profile_id" : null;
}

async function serializeRemarks(rows: Array<{ id: string; content: string; created_by: string | null; created_at: string }>, userId: string, role: string) {
  const authorIds = [...new Set(rows.map((row) => row.created_by).filter(Boolean))] as string[];
  const { data: authors } = authorIds.length ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", authorIds) : { data: [] };
  const authorById = new Map((authors ?? []).map((author) => [author.id, author]));
  const privileged = ["admin", "director", "dev"].includes(role);
  return rows.map((row) => { const author = row.created_by ? authorById.get(row.created_by) : null; return { id: row.id, content: row.content, createdAt: row.created_at, authorName: author?.full_name?.trim() || author?.email || "Unknown user", canDelete: privileged || row.created_by === userId }; });
}

export async function GET(request: NextRequest) {
  const auth = await context();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const type = request.nextUrl.searchParams.get("type") ?? "";
  const profileId = request.nextUrl.searchParams.get("profileId") ?? "";
  const column = parentColumn(type);
  if (!column || !profileId) return NextResponse.json({ error: "A valid profile type and ID are required." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("customer_profile_remarks").select("id, content, created_by, created_at").eq(column, profileId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ remarks: await serializeRemarks(data ?? [], auth.user.id, auth.role) });
}

export async function POST(request: NextRequest) {
  const auth = await context();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { type?: string; profileId?: string; content?: string };
  const column = parentColumn(body.type ?? "");
  const content = body.content?.trim() ?? "";
  if (!column || !body.profileId || !content) return NextResponse.json({ error: "A profile and remark are required." }, { status: 400 });
  const parentTable = body.type === "client" ? "customer_client_profiles" : "customer_company_profiles";
  const { data: parent } = await supabaseAdmin.from(parentTable).select("id").eq("id", body.profileId).maybeSingle();
  if (!parent) return NextResponse.json({ error: "Customer profile not found." }, { status: 404 });
  const { data, error } = await supabaseAdmin.from("customer_profile_remarks").insert({ [column]: body.profileId, content, created_by: auth.user.id }).select("id, content, created_by, created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const [remark] = await serializeRemarks([data], auth.user.id, auth.role);
  return NextResponse.json({ remark }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await context();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { id?: string };
  if (!body.id) return NextResponse.json({ error: "Remark ID is required." }, { status: 400 });
  const { data: remark } = await supabaseAdmin.from("customer_profile_remarks").select("id, created_by").eq("id", body.id).maybeSingle();
  if (!remark) return NextResponse.json({ error: "Remark not found." }, { status: 404 });
  if (remark.created_by !== auth.user.id && !["admin", "director", "dev"].includes(auth.role)) return NextResponse.json({ error: "You can only delete your own remarks." }, { status: 403 });
  const { error } = await supabaseAdmin.from("customer_profile_remarks").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

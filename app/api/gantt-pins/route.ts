import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function authenticated() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("gantt_client_pins").select("client_id, pinned_at").eq("user_id", user.id).order("pinned_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clientIds: (data ?? []).map((pin) => pin.client_id) });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { clientId?: string };
  if (!body.clientId) return NextResponse.json({ error: "Client ID is required." }, { status: 400 });
  const { error } = await supabase.from("gantt_client_pins").upsert({ user_id: user.id, client_id: body.clientId }, { onConflict: "user_id,client_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pinned: true });
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { clientId?: string };
  if (!body.clientId) return NextResponse.json({ error: "Client ID is required." }, { status: 400 });
  const { error } = await supabase.from("gantt_client_pins").delete().eq("user_id", user.id).eq("client_id", body.clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pinned: false });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const key = String(req.nextUrl.searchParams.get("key") ?? "");
    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const { data, error } = await supabase
      .from("user_settings")
      .select("value")
      .eq("user_id", user.id)
      .eq("key", key)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If value is a JSON string, try to parse it so clients get structured data
    let parsed: any = data?.value ?? null;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {}
    }

    return NextResponse.json({ ok: true, value: parsed ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const key = String(body?.key ?? "");
    const value = body?.value ?? null;

    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    // Supabase column `value` is stored as text; stringify non-string values
    const valueToStore = typeof value === 'string' || value == null ? value : JSON.stringify(value);

    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, key, value: valueToStore }, { onConflict: "user_id,key" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected server error" }, { status: 500 });
  }
}

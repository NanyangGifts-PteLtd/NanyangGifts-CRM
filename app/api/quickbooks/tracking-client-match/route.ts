import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSystemLabel } from "@/lib/system-labels";

export async function POST(request: NextRequest) {
  try {
    const { clientId } = await request.json();
    if (typeof clientId !== "string" || !clientId.trim()) {
      return NextResponse.json({ error: "A client is required." }, { status: 400 });
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!["director", "dev"].includes(String(profile?.role ?? "").toLowerCase())) {
      return NextResponse.json({ error: "Only directors and developers can verify a Tracking match." }, { status: 403 });
    }
    const verified = await getSystemLabel(
      "tracking_price_invoice_match",
      "tracking_price_invoice_match_verified",
    );
    const { error } = await supabaseAdmin
      .from("clients")
      .update({
        tracking_overall_price_invoice_match: verified.value,
        tracking_overall_price_invoice_match_option_id: verified.id,
      })
      .eq("id", clientId);
    if (error) throw error;
    return NextResponse.json({ value: verified.value, optionId: verified.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not verify the match." },
      { status: 500 },
    );
  }
}

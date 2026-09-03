import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!["pm", "admin", "director", "dev"].includes(profile?.role?.toLowerCase() ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ids = (request.nextUrl.searchParams.get("subitemIds") ?? "").split(",").filter(Boolean);
  if (!ids.length) return NextResponse.json({ shipmentsBySubitemId: {} });
  const { data, error } = await supabaseAdmin
    .from("shipper_shipment_items")
    .select("subitem_id, shipment:shipper_shipments(id, cn_tracking_no, date_of_submission, shipper_id, shippers(name))")
    .in("subitem_id", ids)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const shipmentsBySubitemId = (data ?? []).reduce<Record<string, unknown[]>>((result, row: any) => {
    if (row.subitem_id && row.shipment) result[row.subitem_id] = [...(result[row.subitem_id] ?? []), row.shipment];
    return result;
  }, {});
  return NextResponse.json({ shipmentsBySubitemId });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createShipment } from "@/lib/shipper/shipments";

const ROLES = ["pm", "director", "dev"];
async function authorized() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return null; const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(); return data?.role && ROLES.includes(data.role) ? user : null; }

export async function POST(request: NextRequest) {
  const user = await authorized(); if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as { action?: "create" | "update" | "delete" | "pushStandalone"; id?: string; shipperId?: string; values?: Record<string, string> };
  if (body.action === "create" && body.shipperId) { const { data, error } = await supabaseAdmin.from("shipper_staging_rows").insert({ shipper_id: body.shipperId, values: body.values ?? {}, created_by: user.id }).select().single(); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data); }
  if (body.action === "update" && body.id) { const { data: current, error: readError } = await supabaseAdmin.from("shipper_staging_rows").select("values").eq("id", body.id).single(); if (readError) return NextResponse.json({ error: readError.message }, { status: 500 }); const { data, error } = await supabaseAdmin.from("shipper_staging_rows").update({ values: { ...(current.values ?? {}), ...(body.values ?? {}) }, updated_at: new Date().toISOString() }).eq("id", body.id).select().single(); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data); }
  if (body.action === "delete" && body.id) { const { error } = await supabaseAdmin.from("shipper_staging_rows").delete().eq("id", body.id); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true }); }
  if (body.action === "pushStandalone" && body.id) {
    const { data: row, error: rowError } = await supabaseAdmin.from("shipper_staging_rows").select("shipper_id, values").eq("id", body.id).single();
    if (rowError || !row) return NextResponse.json({ error: rowError?.message ?? "Staging row not found" }, { status: 404 });
    const values = (row.values ?? {}) as Record<string, string>;
    const number = (key: string) => values[key]?.trim() ? Number(values[key]) : null;
    const numericKeys = ["cartons", "qty", "up"];
    if (numericKeys.some((key) => values[key]?.trim() && !Number.isFinite(Number(values[key])))) return NextResponse.json({ error: "Qty, Unit Price, and Cartons must be numbers." }, { status: 400 });
    if (values.info_provided_date && !/^\d{4}-\d{2}-\d{2}$/.test(values.info_provided_date)) return NextResponse.json({ error: "Date of submission must use YYYY-MM-DD." }, { status: 400 });
    if (values.sea_or_air && !["空运", "海运", "海运/小包"].includes(values.sea_or_air)) return NextResponse.json({ error: "Select a valid Sea or Air value." }, { status: 400 });
    if (values.tax_refund && !["退", "X"].includes(values.tax_refund)) return NextResponse.json({ error: "Select a valid tax refund value." }, { status: 400 });
    try {
      const created = await createShipment({
        shipperId: row.shipper_id,
        kind: "standalone",
        dateOfSubmission: values.info_provided_date || null,
        deliveryInfo: values.delivery_info || null,
        seaOrAir: values.sea_or_air as "空运" | "海运" | "海运/小包" | null,
        taxRefund: values.tax_refund as "退" | "X" | null,
        items: [{
          lineType: "standalone",
          displayName: values.item_name || "Standalone shipment item",
          quantity: number("qty"),
          unitPrice: number("up"),
          cnTrackingNo: values.cn_tracking_no || null,
          cartons: number("cartons"),
          samplesByAir: values.samples_by_air || null,
          samplesBySea: values.samples_by_sea || null,
          airReceived: values.air_received || null,
          seaReceived: values.sea_received || null,
          remarks: values.shipper_remarks || null,
        }],
      }, user.id);
      const { error: deleteError } = await supabaseAdmin.from("shipper_staging_rows").delete().eq("id", body.id);
      if (deleteError) return NextResponse.json({ error: `Shipment was created, but staging row could not be removed: ${deleteError.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, shipment: created.shipment });
    } catch (error: any) {
      return NextResponse.json({ error: error?.message ?? "Could not create standalone shipment." }, { status: 400 });
    }
  }
  return NextResponse.json({ error: "Invalid staging action" }, { status: 400 });
}

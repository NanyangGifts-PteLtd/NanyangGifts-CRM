import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ShipperRow } from "@/app/(protected)/app/shipper/[token]/ShipperGrid";

export async function getShipperSubitems(shipperId?: string): Promise<ShipperRow[]> {
    let query = supabaseAdmin
        .from("shipper_view_rows")
        .select(`
        id,
        subitem_id,
        client_id,
        shipper_id,
        waybill_date,
        waybill_number,
        pieces,
        chargeable_weight_kg,
        destination,
        freight_unit_price,
        freight_cost,
        gst,
        other_fees,
        total_cost,
        channel,
        logistics_remarks,
        ic,
        info_provided_date,
        cn_tracking_no,
        cartons,
        item_name,
        delivery_info,
        qty,
        up,
        value,
        sea_or_air,
        tax_refund,
        shipper_remarks,
        samples_by_air
    `)
        .order("id", { ascending: false });

    if (shipperId) {
        query = query.eq("shipper_id", shipperId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data ?? []) as ShipperRow[];
}
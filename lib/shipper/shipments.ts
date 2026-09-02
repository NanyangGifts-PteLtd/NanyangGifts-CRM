import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type ShipmentKind = "shipment" | "sample" | "expedited" | "standalone";
export type ShipmentLineType = "subitem_delivery" | "subitem_partial_delivery" | "standalone";

export type ShipmentItemInput = {
    subitemId?: string | null;
    clientId?: string | null;
    lineType: ShipmentLineType;
    displayName: string;
    quantity?: number | null;
    unitPrice?: number | null;
    declaredValue?: number | null;
    cnTrackingNo?: string | null;
    cartons?: number | null;
    samplesByAir?: string | null;
    samplesBySea?: string | null;
    airReceived?: string | null;
    seaReceived?: string | null;
    remarks?: string | null;
};

export type ShipmentInput = {
    shipperId: string;
    kind?: ShipmentKind;
    dateOfSubmission?: string | null;
    cnTrackingNo?: string | null;
    cartons?: number | null;
    deliveryInfo?: string | null;
    seaOrAir?: "空运" | "海运" | "海运/小包" | null;
    taxRefund?: "退" | "X" | null;
    samplesByAir?: string | null;
    samplesBySea?: string | null;
    remarks?: string | null;
    ic?: string | null;
    serialNumber?: string | null;
    waybillDate?: string | null;
    waybillNumber?: string | null;
    pieces?: number | null;
    chargeableWeightKg?: number | null;
    destination?: string | null;
    freightUnitPrice?: number | null;
    gst?: number | null;
    otherFees?: number | null;
    channel?: string | null;
    items: ShipmentItemInput[];
};

export async function createShipment(input: ShipmentInput, createdBy: string) {
    if (!input.shipperId) throw new Error("A shipper is required.");
    if (!input.items.length) throw new Error("Add at least one shipment item.");

    const combinedDeclaredValue = input.items.reduce((total, item) => total + (item.declaredValue ?? ((item.quantity ?? 0) * (item.unitPrice ?? 0))), 0);
    const freightCost = (input.chargeableWeightKg ?? 0) * (input.freightUnitPrice ?? 0);
    const totalCost = freightCost + (input.gst ?? 0) + (input.otherFees ?? 0);

    const { data: shipment, error: shipmentError } = await supabaseAdmin
        .from("shipper_shipments")
        .insert({
            shipper_id: input.shipperId,
            shipment_kind: input.kind ?? "shipment",
            date_of_submission: input.dateOfSubmission ?? null,
            cn_tracking_no: input.cnTrackingNo ?? null,
            cartons: input.cartons ?? null,
            delivery_info: input.deliveryInfo ?? null,
            sea_or_air: input.seaOrAir ?? null,
            // Tax refund belongs to the combined physical shipment, not a line.
            tax_refund: input.taxRefund ?? (combinedDeclaredValue > 2500 ? "退" : "X"),
            samples_by_air: input.samplesByAir ?? null,
            samples_by_sea: input.samplesBySea ?? null,
            remarks: input.remarks ?? null,
            ic: input.ic ?? null,
            serial_number: input.serialNumber ?? null,
            waybill_date: input.waybillDate ?? null,
            waybill_number: input.waybillNumber ?? null,
            pieces: input.pieces ?? null,
            chargeable_weight_kg: input.chargeableWeightKg ?? null,
            destination: input.destination ?? null,
            freight_unit_price: input.freightUnitPrice ?? null,
            freight_cost: freightCost || null,
            gst: input.gst ?? null,
            other_fees: input.otherFees ?? null,
            total_cost: totalCost || null,
            channel: input.channel ?? null,
            created_by: createdBy,
        })
        .select()
        .single();

    if (shipmentError || !shipment) throw new Error(shipmentError?.message ?? "Could not create shipment.");

    const { data: items, error: itemError } = await supabaseAdmin
        .from("shipper_shipment_items")
        .insert(input.items.map((item, position) => ({
            shipment_id: shipment.id,
            subitem_id: item.subitemId ?? null,
            client_id: item.clientId ?? null,
            line_type: item.lineType,
            position,
            display_name: item.displayName.trim(),
            quantity: item.quantity ?? null,
            unit_price: item.unitPrice ?? null,
            declared_value: item.declaredValue ?? (item.quantity != null && item.unitPrice != null ? item.quantity * item.unitPrice : null),
            cn_tracking_no: item.cnTrackingNo ?? null,
            cartons: item.cartons ?? null,
            samples_by_air: item.samplesByAir ?? null,
            samples_by_sea: item.samplesBySea ?? null,
            air_received: item.airReceived ?? null,
            sea_received: item.seaReceived ?? null,
            remarks: item.remarks ?? null,
        })))
        .select();

    if (itemError) {
        await supabaseAdmin.from("shipper_shipments").delete().eq("id", shipment.id);
        throw new Error(itemError.message);
    }

    return { shipment, items: items ?? [] };
}

export async function getShipperShipments(shipperId?: string) {
    let query = supabaseAdmin
        .from("shipper_shipments")
        .select("*, items:shipper_shipment_items(*)")
        // Spreadsheet-style shipper sheets grow downward: the newest push is
        // therefore the last shipment shown, rather than the first.
        .order("created_at", { ascending: true })
        .order("position", { referencedTable: "shipper_shipment_items", ascending: true });

    if (shipperId) query = query.eq("shipper_id", shipperId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

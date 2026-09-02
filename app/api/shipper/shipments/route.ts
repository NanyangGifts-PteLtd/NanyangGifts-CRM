import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createShipment, getShipperShipments, type ShipmentInput } from "@/lib/shipper/shipments";

const ALLOWED_ROLES = new Set(["pm", "director", "dev"]);

async function currentProfile() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "Unauthorized" as const };

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
    .select("id, role")
        .eq("id", user.id)
        .single();
    if (profileError || !profile || (![...ALLOWED_ROLES, "shipper"].includes(profile.role ?? ""))) return { error: "Forbidden" as const };
    return { user, profile };
}

export async function GET(request: NextRequest) {
    const session = await currentProfile();
    if ("error" in session) return NextResponse.json({ error: session.error }, { status: session.error === "Unauthorized" ? 401 : 403 });
    if (!ALLOWED_ROLES.has(session.profile.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const shipperId = request.nextUrl.searchParams.get("shipperId") ?? undefined;
        return NextResponse.json({ shipments: await getShipperShipments(shipperId) });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message ?? "Could not load shipments." }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await currentProfile();
    if ("error" in session) return NextResponse.json({ error: session.error }, { status: session.error === "Unauthorized" ? 401 : 403 });
    if (!ALLOWED_ROLES.has(session.profile.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const input = await request.json() as ShipmentInput;
        const created = await createShipment(input, session.user.id);
        return NextResponse.json(created, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message ?? "Could not create shipment." }, { status: 400 });
    }
}

const shipmentFields = new Set([
    "serial_number", "waybill_date", "waybill_number", "pieces",
    "chargeable_weight_kg", "destination", "freight_unit_price", "gst",
    "other_fees", "channel", "ic", "date_of_submission", "cn_tracking_no",
    "cartons", "delivery_info", "sea_or_air", "tax_refund",
    "samples_by_air", "samples_by_sea", "remarks", "logistics_remarks",
    "cell_fills",
]);

const itemFields = new Set([
    "display_name", "quantity", "unit_price", "declared_value", "cn_tracking_no", "cartons", "remarks",
    "samples_by_air", "samples_by_sea", "air_received", "sea_received", "cell_fills",
]);

const numericShipmentFields = new Set([
    "pieces", "chargeable_weight_kg", "freight_unit_price", "gst", "other_fees", "cartons",
]);

const numericItemFields = new Set(["quantity", "unit_price", "cartons"]);

function nullableNumber(value: unknown) {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error("This field must be a number.");
    return parsed;
}

function validatedValue(field: string, value: unknown, numericFields: Set<string>) {
    if (numericFields.has(field)) return nullableNumber(value);
    if (field === "sea_or_air" && value && !["空运", "海运", "海运/小包"].includes(String(value))) {
        throw new Error("Sea or Air must be 空运, 海运, or 海运/小包.");
    }
    if (field === "tax_refund" && value && !["退", "X"].includes(String(value))) {
        throw new Error("退税 must be 退 or X.");
    }
    if (["date_of_submission", "waybill_date"].includes(field) && value && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        throw new Error("Date must use YYYY-MM-DD.");
    }
    if (field === "cell_fills") {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Invalid cell fill data.");
        return parsed;
    }
    return value === "" ? null : value;
}

export async function PATCH(request: NextRequest) {
    const session = await currentProfile();
    if ("error" in session) return NextResponse.json({ error: session.error }, { status: session.error === "Unauthorized" ? 401 : 403 });
    const supabase = await createClient();

    try {
        const body = await request.json() as {
            shipmentId?: string;
            itemId?: string;
            field?: string;
            value?: unknown;
        };
        if (!body.field || (!body.shipmentId && !body.itemId) || (body.shipmentId && body.itemId)) {
            return NextResponse.json({ error: "Provide one shipment or item cell to save." }, { status: 400 });
        }

        const table = body.shipmentId ? "shipper_shipments" : "shipper_shipment_items";
        const id = body.shipmentId ?? body.itemId!;
        const allowed = body.shipmentId ? shipmentFields : itemFields;
        if (!allowed.has(body.field)) return NextResponse.json({ error: "Unsupported shipment field." }, { status: 400 });

        if (session.profile.role === "shipper") {
            const shipperId = String(session.user.user_metadata?.shipper_id ?? "");
            const { data: owner, error: ownerError } = body.shipmentId
                ? await supabase.from("shipper_shipments").select("shipper_id").eq("id", id).single()
                : await supabase.from("shipper_shipment_items").select("shipment:shipper_shipments(shipper_id)").eq("id", id).single();
            if (ownerError) throw ownerError;
            const ownerId = body.shipmentId ? (owner as any)?.shipper_id : ((owner as any)?.shipment?.[0]?.shipper_id ?? (owner as any)?.shipment?.shipper_id);
            if (!shipperId || ownerId !== shipperId || !["serial_number", "waybill_date", "waybill_number", "pieces", "chargeable_weight_kg", "destination", "freight_unit_price", "gst", "other_fees", "channel", "logistics_remarks"].includes(body.field)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const value = validatedValue(body.field, body.value, body.shipmentId ? numericShipmentFields : numericItemFields);
        const payload: Record<string, unknown> = { [body.field]: value, updated_at: new Date().toISOString() };

        if (body.shipmentId && ["chargeable_weight_kg", "freight_unit_price", "gst", "other_fees"].includes(body.field)) {
            const { data: existing, error } = await supabase
                .from("shipper_shipments")
                .select("chargeable_weight_kg, freight_unit_price, gst, other_fees")
                .eq("id", id)
                .single();
            if (error) throw error;
            const weight = Number(body.field === "chargeable_weight_kg" ? value : existing.chargeable_weight_kg) || 0;
            const unitPrice = Number(body.field === "freight_unit_price" ? value : existing.freight_unit_price) || 0;
            const gst = Number(body.field === "gst" ? value : existing.gst) || 0;
            const otherFees = Number(body.field === "other_fees" ? value : existing.other_fees) || 0;
            payload.freight_cost = weight * unitPrice;
            payload.total_cost = payload.freight_cost as number + gst + otherFees;
        }

        if (body.itemId && ["quantity", "unit_price"].includes(body.field)) {
            const { data: existing, error } = await supabase
                .from("shipper_shipment_items")
                .select("quantity, unit_price")
                .eq("id", id)
                .single();
            if (error) throw error;
            const quantity = Number(body.field === "quantity" ? value : existing.quantity) || 0;
            const unitPrice = Number(body.field === "unit_price" ? value : existing.unit_price) || 0;
            payload.declared_value = quantity * unitPrice;
        }

        const { error } = await supabase.from(table).update(payload).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true, values: payload });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message ?? "Could not save shipment cell." }, { status: 400 });
    }
}

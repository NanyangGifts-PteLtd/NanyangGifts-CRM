import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShipperByToken } from "@/lib/shipper/get-shipper-by-token";

const ALLOWED_SHIPPER_FIELDS = [
    "waybill_date",
    "waybill_number",
    "pieces",
    "chargeable_weight_kg",
    "destination",
    "freight_unit_price",
    "freight_cost",
    "gst",
    "other_fees",
    "total_cost",
    "channel",
    "logistics_remarks",
] as const;

type AllowedShipperField = (typeof ALLOWED_SHIPPER_FIELDS)[number];

type ShipperUpdateBody = {
    token: string;
    rowId: string;
    field: AllowedShipperField;
    value: string | number | null;
};

export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const body = (await req.json()) as ShipperUpdateBody;

        if (!body.token || !body.rowId || !body.field) {
            return NextResponse.json({ error: "Missing token, rowId, or field" }, { status: 400 });
        }

        if (!ALLOWED_SHIPPER_FIELDS.includes(body.field)) {
            return NextResponse.json({ error: "Field is not editable by shipper" }, { status: 403 });
        }

        const shipper = await getShipperByToken(body.token);

        if (!shipper) {
            return NextResponse.json({ error: "Invalid or expired shipper token" }, { status: 401 });
        }

        const { data: row, error: rowError } = await supabase
            .from("shipper_items")
            .select("id, shipper_id")
            .eq("id", body.rowId)
            .single();

        if (rowError || !row) {
            return NextResponse.json({ error: "Shipper row not found" }, { status: 404 });
        }

        if (row.shipper_id !== shipper.id) {
            return NextResponse.json({ error: "Row does not belong to shipper" }, { status: 403 });
        }

        const payload: Record<string, string | number | null> = {
            [body.field]: body.value,
        };

        const { error: updateError } = await supabase
            .from("shipper_items")
            .update(payload)
            .eq("id", body.rowId)
            .eq("shipper_id", shipper.id);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message ?? "Unexpected server error" },
            { status: 500 }
        );
    }
}
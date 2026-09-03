import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Body = {
    subitemId: string;
    shipperId?: string;
    shipperToken?: string;
    field: string;
    value: unknown;
};

const FIELD_MAP: Record<string, string> = {
    serial_number: "serial_number",
    waybill_date: "waybill_date",
    waybill_number: "waybill_number",
    pieces: "pieces",
    chargeable_weight_kg: "chargeable_weight_kg",
    destination: "destination",
    freight_unit_price: "freight_unit_price",
    freight_cost: "freight_cost",
    gst: "gst",
    other_fees: "other_fees",
    channel: "channel",
    logistics_remarks: "logistics_remarks",
    ic: "ic",
    info_provided_date: "info_provided_date",
    cn_tracking_no: "cn_tracking_no",
    cartons: "cartons",
    item_name: "item_name",
    delivery_info: "delivery_info",
    qty: "qty",
    up: "up",
    sea_or_air: "sea_or_air",
    tax_refund: "tax_refund",
    shipper_remarks: "shipper_remarks",
    samples_by_air: "samples_by_air",
    samples_by_sea: "samples_by_sea",
    air_received: "air_received",
    sea_received: "sea_received",
    cell_fills: "cell_fills",
};

function toNumberOrNull(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

export async function POST(req: NextRequest) {
    try {
        const sessionClient = await createClient();
        const { data: { user } } = await sessionClient.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { data: profile } = await sessionClient
            .from('profiles')
            .select('role, shipper_id')
            .eq('id', user.id)
            .maybeSingle();
        const role = profile?.role?.toLowerCase() ?? '';
        const isShipmentStaff = ['pm', 'admin', 'director', 'dev'].includes(role);
        if (!isShipmentStaff && role !== 'shipper') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const body = (await req.json()) as Body;

        if (!body.subitemId || !body.field) {
            return NextResponse.json({ error: 'Missing subitemId or field' }, { status: 400 });
        }

        const dbKey = FIELD_MAP[body.field];
        if (!dbKey) {
            return NextResponse.json({ error: 'Unsupported field' }, { status: 400 });
        }
        const shipperEditableFields = new Set([
            'serial_number', 'waybill_date', 'waybill_number', 'pieces',
            'chargeable_weight_kg', 'destination', 'freight_unit_price', 'gst',
            'other_fees', 'channel', 'logistics_remarks',
        ]);
        if (role === 'shipper' && !shipperEditableFields.has(dbKey)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (dbKey === "info_provided_date" && body.value && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.value))) return NextResponse.json({ error: "Date must use a valid date format" }, { status: 400 });
        if (["pieces", "chargeable_weight_kg", "freight_unit_price", "gst", "other_fees", "cartons", "qty", "up"].includes(dbKey) && body.value !== "" && !Number.isFinite(Number(body.value))) return NextResponse.json({ error: "This field must be a number" }, { status: 400 });
        if (dbKey === "sea_or_air" && body.value && !["空运", "海运", "海运/小包"].includes(String(body.value))) return NextResponse.json({ error: "Sea or Air must be 空运, 海运, or 海运/小包" }, { status: 400 });
        if (dbKey === "tax_refund" && body.value && !["退", "X"].includes(String(body.value))) return NextResponse.json({ error: "退税 must be 退 or X" }, { status: 400 });

        let shipperId = body.shipperId ?? null;

        if (!shipperId && body.shipperToken) {
            const { data: shipper, error: shipperError } = await supabase
                .from('shippers')
                .select('id')
                .eq('token', body.shipperToken)
                .maybeSingle();

            if (shipperError) throw shipperError;
            shipperId = shipper?.id ?? null;
        }

        if (!shipperId) {
            return NextResponse.json(
                { error: 'Shipper is required before saving shipper view rows' },
                { status: 400 }
            );
        }
        if (role === 'shipper' && profile?.shipper_id !== shipperId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data: existing, error: existingError } = await supabase
            .from('shipper_view_rows')
            .select('*')
            .eq('subitem_id', body.subitemId)
            .maybeSingle();

        if (existingError) throw existingError;
        if (role === 'shipper' && (!existing || existing.shipper_id !== shipperId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let nextValue =
            dbKey === 'qty' ||
                dbKey === 'cost' ||
                dbKey === 'ls' ||
                dbKey === 'os' ||
                dbKey === 'tc' ||
                dbKey === 'uc' ||
                dbKey === 'tc_sgd' ||
                dbKey === 'price' ||
                dbKey === 'up' ||
                dbKey === 'chargeable_weight_kg' ||
                dbKey === 'freight_unit_price' ||
                dbKey === 'freight_cost' ||
                dbKey === 'gst' ||
                dbKey === 'other_fees'
                ? toNumberOrNull(body.value)
                : body.value;

        if (dbKey === "cell_fills") {
            try {
                const parsed = typeof body.value === "string" ? JSON.parse(body.value) : body.value;
                if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Invalid fill data");
                nextValue = parsed;
            } catch {
                return NextResponse.json({ error: "Invalid cell fill data" }, { status: 400 });
            }
        }

        const payload: Record<string, unknown> = {
            shipper_id: shipperId,
            subitem_id: body.subitemId,
            updated_at: new Date().toISOString(),
            [dbKey]: nextValue,
        };

        if (body.field === 'qty' || body.field === 'up') {
            const nextQty = toNumberOrNull(
                body.field === 'qty' ? body.value : existing?.qty
            );
            const nextUp = toNumberOrNull(
                body.field === 'up' ? body.value : existing?.up
            );
            payload.value = nextQty !== null && nextUp !== null ? nextQty * nextUp : null;
        }

        if (body.field === 'chargeable_weight_kg' || body.field === 'freight_unit_price' || body.field === 'gst' || body.field === 'other_fees') {
            const nextWeight = toNumberOrNull(body.field === 'chargeable_weight_kg' ? body.value : existing?.chargeable_weight_kg) ?? 0;
            const nextFreightUnitPrice = toNumberOrNull(body.field === 'freight_unit_price' ? body.value : existing?.freight_unit_price) ?? 0;
            const nextFreight = nextWeight * nextFreightUnitPrice;
            const nextGst = toNumberOrNull(body.field === 'gst' ? body.value : existing?.gst) ?? 0;
            const nextOtherFees = toNumberOrNull(body.field === 'other_fees' ? body.value : existing?.other_fees) ?? 0;
            payload.freight_cost = nextFreight;
            payload.total_cost = nextFreight + nextGst + nextOtherFees;
        }

        const { error: upsertError } = await supabase
            .from('shipper_view_rows')
            .upsert(payload, { onConflict: 'subitem_id' });

        if (upsertError) throw upsertError;

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message ?? 'Unknown error' },
            { status: 500 }
        );
    }
}

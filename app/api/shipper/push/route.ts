import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PushShipperViewBody = {
    subitemIds: string[];
};

const ALLOWED_ROLES = ["pm", "director", "dev"];

type OcfJoinRow = {
    id: string;
    subitem_id: string;
    delivery_contact_number: string | null;
    delivery_address: string | null;
    order_confirmations: {
        id: string;
        client_submitted_at: string | null;
    } | null;
};

function buildDeliveryInfo(item?: {
    delivery_contact_number?: string | null;
    delivery_address?: string | null;
}) {
    if (!item) return null;

    const parts = [
        item.delivery_contact_number ? `Contact: ${item.delivery_contact_number}` : null,
        item.delivery_address ? `Address: ${item.delivery_address}` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join("\n") : null;
}

function getSingaporeDate() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Singapore",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, role, full_name, email")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 403 });
        }

        if (!ALLOWED_ROLES.includes(profile.role ?? "")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = (await req.json()) as PushShipperViewBody;
        const subitemIds = Array.isArray(body.subitemIds) ? body.subitemIds : [];

        if (subitemIds.length === 0) {
            return NextResponse.json({ error: "subitemIds is required" }, { status: 400 });
        }

        const { data: subitems, error: subitemsError } = await supabase
            .from("subitems")
            .select(`
        id,
        client_id,
        name,
        qty,
        price,
        up,
        cn_tracking,
        shipper,
        shipper_id
      `)
            .in("id", subitemIds)
            .not("shipper_id", "is", null);

        if (subitemsError) {
            return NextResponse.json({ error: subitemsError.message }, { status: 500 });
        }

        if (!subitems || subitems.length === 0) {
            return NextResponse.json({ error: "Subitem has no shipper_id with supported shipper view" }, { status: 404 });
        }

        const pushedByName = profile.full_name?.trim() || profile.email || user.email || user.id;
        const pushedDate = getSingaporeDate();

        const subitemIdList = subitems.map((item) => item.id);

        const { data: ocfItemsRaw, error: ocfItemsError } = await supabase
            .from("order_confirmation_items")
            .select(`
        id,
        subitem_id,
        delivery_contact_number,
        delivery_address,
        order_confirmations!inner (
            id,
            client_submitted_at
        )
    `)
            .in("subitem_id", subitemIdList);

        if (ocfItemsError) {
            return NextResponse.json({ error: ocfItemsError.message }, { status: 500 });
        }

        const ocfItems = (ocfItemsRaw ?? []) as unknown as OcfJoinRow[];
        const ocfItemBySubitemId = new Map<string, OcfJoinRow>();

        for (const item of ocfItems) {
            ocfItemBySubitemId.set(item.subitem_id, item);
        }

        const rowsToUpsert = subitems.map((item) => {
            const ocfItem = ocfItemBySubitemId.get(item.id);

            return {
                subitem_id: item.id,
                client_id: item.client_id ?? null,
                order_confirmation_item_id: ocfItem?.id ?? null,
                pushed_by: user.id,
                shipper_id: item.shipper_id ?? null,
                serial_number: null,
                waybill_date: null,
                waybill_number: null,
                pieces: null,
                chargeable_weight_kg: null,
                destination: null,
                freight_unit_price: null,
                freight_cost: null,
                gst: null,
                other_fees: null,
                total_cost: null,
                channel: null,
                logistics_remarks: null,
                ic: pushedByName,
                info_provided_date: pushedDate,
                cn_tracking_no: item.cn_tracking,
                cartons: null,
                item_name: item.name ?? null,
                delivery_info: buildDeliveryInfo(ocfItem) ?? null,
                qty: item.qty ?? null,
                up: item.up ?? null,
                value: Number(item.qty ?? 0) * Number(item.up ?? 0),
                sea_or_air: null,
                tax_refund: null,
                shipper_remarks: null,
                samples_by_air: null,
                samples_by_sea: null,
                air_received: null,
                sea_received: null,
            };
        });

        const { data: pushedRows, error: upsertError } = await supabase
            .from("shipper_view_rows")
            .upsert(rowsToUpsert, { onConflict: "subitem_id" })
            .select();

        if (upsertError) {
            return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            count: pushedRows?.length ?? 0,
            rows: pushedRows ?? [],
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message ?? "Unexpected server error" },
            { status: 500 }
        );
    }
}
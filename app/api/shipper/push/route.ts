import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type PushShipperViewBody = {
    subitemIds: string[];
    overwrite?: boolean;
    preview?: boolean;
    targetShipperId?: string;
    targetShipperLabel?: string;
    values?: Array<Record<string, unknown> & { subitemId: string }>;
};

const PREVIEW_FIELDS = [
    "cn_tracking_no", "ic", "info_provided_date", "cartons", "qty", "up",
    "tax_refund", "delivery_info", "sea_or_air", "shipper_remarks",
    "samples_by_air", "samples_by_sea", "item_name", "air_received", "sea_received",
] as const;
const REQUIRED_PREVIEW_FIELDS = PREVIEW_FIELDS.filter((field) => !["cartons", "shipper_remarks", "item_name", "air_received", "sea_received"].includes(field));

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

function getSeaOrAir(shipperLabel: string | null | undefined) {
    const label = shipperLabel?.toUpperCase() ?? "";
    if (label.includes("SEA")) return "海运";
    if (label.includes("AIR")) return "空运";
    // A5 汇荣 is generally AIR, so for now we hardcode it to AIR
    if (label.includes("A5 汇荣")) return "空运";
    return null;
}

function validLabelsForShipper(shipperName: string | null | undefined) {
    const name = shipperName?.trim() ?? "";
    if (/^tiger$/i.test(name)) return [`${name} - SEA`, `${name} - AIR`];
    if (name === "小李") return [`${name} - SEA`, `${name} - AIR`];
    if (name === "A5 汇荣") return [name];
    return name ? [name] : [];
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

        const { data: allShippers, error: shippersError } = await supabase
            .from("shippers")
            .select("id, name");

        if (shippersError) {
            return NextResponse.json({ error: shippersError.message }, { status: 500 });
        }

        const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";
        const shipperByName = new Map(
            (allShippers ?? []).map((shipper) => [normalize(shipper.name), shipper.id])
        );
        const shipperNameById = new Map((allShippers ?? []).map((shipper) => [shipper.id, shipper.name]));
        const shipperIds = new Set((allShippers ?? []).map((shipper) => shipper.id));
        const resolveShipperId = (label: string | null | undefined) => {
            const normalizedLabel = normalize(label);
            if (!normalizedLabel) return null;

            const exactId = shipperByName.get(normalizedLabel);
            if (exactId) return exactId;

            const baseName = normalizedLabel.replace(/\s+-\s+(sea|air)\s*$/i, "").trim();
            return shipperByName.get(baseName) ?? null;
        };

        const { data: rawSubitems, error: subitemsError } = await supabase
            .from("subitems")
            .select(`
        id,
        client_id,
        name,
        qty,
        cost,
        price,
        up,
        cn_tracking,
        shipper,
        shipper_id
            `)
            .in("id", subitemIds);

        if (subitemsError) {
            return NextResponse.json({ error: subitemsError.message }, { status: 500 });
        }

        const clientIds = [...new Set((rawSubitems ?? []).map((item) => item.client_id).filter(Boolean))] as string[];
        const [{ data: assignedSubitems }, { data: assignedClients }, { data: permissionClients }] = await Promise.all([
            supabaseAdmin.from("subitem_assignees").select("subitem_id").eq("user_id", user.id).in("subitem_id", subitemIds),
            clientIds.length ? supabaseAdmin.from("client_assignees").select("client_id").eq("user_id", user.id).in("client_id", clientIds) : Promise.resolve({ data: [] }),
            clientIds.length ? supabaseAdmin.from("clients").select("id, custom_fields").in("id", clientIds) : Promise.resolve({ data: [] }),
        ]);
        const assignedSubitemIds = new Set((assignedSubitems ?? []).map((row) => row.subitem_id));
        const assignedClientIds = new Set((assignedClients ?? []).map((row) => row.client_id));
        const pmClientIds = new Set((permissionClients ?? []).filter((client) => { try { const ids = JSON.parse(client.custom_fields?.pmAssigneeIds ?? "[]"); return Array.isArray(ids) && ids.includes(user.id); } catch { return false; } }).map((client) => client.id));
        const forbiddenSubitems = (rawSubitems ?? []).filter((item) => !assignedSubitemIds.has(item.id) && (!item.client_id || (!assignedClientIds.has(item.client_id) && !pmClientIds.has(item.client_id))));
        if (forbiddenSubitems.length) return NextResponse.json({ error: "You can only edit items that are assigned to you" }, { status: 403 });

        const targetShipper = body.targetShipperId ? (allShippers ?? []).find((shipper) => shipper.id === body.targetShipperId) : null;
        if (body.targetShipperId && !targetShipper) return NextResponse.json({ error: "The selected shipper view is invalid" }, { status: 400 });
        const targetLabels = validLabelsForShipper(targetShipper?.name);
        if (body.targetShipperLabel && !targetLabels.includes(body.targetShipperLabel)) return NextResponse.json({ error: "The selected shipper option is not valid for this shipper view" }, { status: 400 });

        const subitems = (rawSubitems ?? []).map((item) => ({
            ...item,
            configured_shipper_id: item.shipper_id && shipperIds.has(item.shipper_id)
                ? item.shipper_id
                : resolveShipperId(item.shipper),
            shipper_id: body.targetShipperId ?? (item.shipper_id && shipperIds.has(item.shipper_id) ? item.shipper_id : resolveShipperId(item.shipper)),
            shipper: body.targetShipperLabel ?? item.shipper,
        }));
        const unresolvedItems = subitems.filter((item) => !item.shipper_id);

        if (subitems.length === 0 || unresolvedItems.length > 0) {
            return NextResponse.json({
                error: unresolvedItems.length > 0
                    ? `Unsupported shipper label: ${unresolvedItems.map((item) => item.shipper || "blank").join(", ")}`
                    : "Subitem has no shipper configured",
            }, { status: 404 });
        }

        for (const item of subitems) {
            const rawItem = rawSubitems?.find((raw) => raw.id === item.id);
            if (!body.preview && item.shipper_id && (rawItem?.shipper_id !== item.shipper_id || (body.targetShipperLabel && rawItem?.shipper !== body.targetShipperLabel))) {
                const { error: repairError } = await supabase
                    .from("subitems")
                    .update({ shipper_id: item.shipper_id, ...(body.targetShipperLabel ? { shipper: body.targetShipperLabel } : {}) })
                    .eq("id", item.id);
                if (repairError) {
                    return NextResponse.json({ error: repairError.message }, { status: 500 });
                }
            }
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

        const defaults: Array<Record<string, any>> = subitems.map((item) => {
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
                up: item.cost ?? null,
                value: Number(item.qty ?? 0) * Number(item.cost ?? 0),
                sea_or_air: getSeaOrAir(item.shipper),
                tax_refund: Number(item.qty ?? 0) * Number(item.cost ?? 0) > 2500 ? "退" : "X",
                shipper_remarks: null,
                samples_by_air: null,
                samples_by_sea: null,
                air_received: null,
                sea_received: null,
            };
        });

        const { data: existingRows, error: existingRowsError } = await supabase
            .from("shipper_view_rows")
            .select("*")
            .in("subitem_id", subitems.map((item) => item.id));
        if (existingRowsError) return NextResponse.json({ error: existingRowsError.message }, { status: 500 });
        const existingBySubitemId = new Map((existingRows ?? []).map((row) => [row.subitem_id, row]));

        const previews: Array<Record<string, any>> = defaults.map((defaultsRow) => {
            const existing = existingBySubitemId.get(defaultsRow.subitem_id);
            // Existing shipper data takes precedence so a re-push can be reviewed without losing prior work.
            if (!existing) return defaultsRow;
            const merged = { ...defaultsRow, ...existing } as Record<string, unknown>;
            // The original direct-push rows have several null fields. Retain useful source defaults for those.
            for (const field of PREVIEW_FIELDS) {
                if (merged[field] === null || merged[field] === undefined) merged[field] = defaultsRow[field];
            }
            return { ...merged, shipper_id: defaultsRow.shipper_id, value: Number(merged.qty ?? 0) * Number(merged.up ?? 0) };
        });

        if (body.preview) return NextResponse.json({
            ok: true,
            rows: previews.map((row) => {
                const source = subitems.find((item) => item.id === row.subitem_id);
                const configuredLabelIsValid = !targetShipper || targetLabels.includes(rawSubitems?.find((item) => item.id === row.subitem_id)?.shipper ?? "");
                return { ...row, already_pushed: existingBySubitemId.has(row.subitem_id), shipper_name: shipperNameById.get(row.shipper_id) ?? "Selected shipper", shipper_mismatch: !!targetShipper && (source?.configured_shipper_id !== targetShipper.id || !configuredLabelIsValid), configured_shipper: rawSubitems?.find((item) => item.id === row.subitem_id)?.shipper || "Not set", valid_shipper_labels: targetLabels };
            }),
        });

        const suppliedBySubitemId = new Map((body.values ?? []).map((value) => [value.subitemId, value]));
        const rowsToUpsert: Array<Record<string, any>> = previews.map((preview) => {
            const supplied = suppliedBySubitemId.get(preview.subitem_id);
            const edits = Object.fromEntries(PREVIEW_FIELDS.map((field) => [field, supplied?.[field] ?? preview[field]]));
            const missing = REQUIRED_PREVIEW_FIELDS.filter((field) => {
                const value = edits[field];
                return value === null || value === undefined || String(value).trim() === "";
            });
            if (missing.length) throw new Error(`Complete all mandatory fields before pushing: ${missing.join(", ")}`);
            const qty = Number(edits.qty);
            const up = Number(edits.up);
            if (!Number.isFinite(qty) || !Number.isFinite(up)) throw new Error("Qty and Unit Price must be valid numbers.");
            return {
                ...preview,
                ...edits,
                qty,
                up,
                value: qty * up,
                // These relationships always come from the source CRM record, never the dialog.
                subitem_id: preview.subitem_id,
                client_id: preview.client_id,
                shipper_id: preview.shipper_id,
                pushed_by: user.id,
            };
        });

        const { data: pushedRows, error: upsertError } = await supabase
            .from("shipper_view_rows")
            .upsert(rowsToUpsert, { onConflict: "subitem_id" })
            .select();

        if (upsertError) {
            return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }

        // CN Tracking is deliberately a two-way value: the reviewed value is also stored on the CRM subitem.
        for (const row of rowsToUpsert) {
            const { error } = await supabase.from("subitems").update({ cn_tracking: row.cn_tracking_no }).eq("id", row.subitem_id);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

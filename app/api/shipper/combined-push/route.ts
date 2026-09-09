import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createShipment, type ShipmentInput } from "@/lib/shipper/shipments";
import { createCrmSpreadsheetRows } from "@/lib/shipper/spreadsheet";

type PushValue = Record<string, string> & { subitemId: string };
type Body = { subitemIds: string[]; values: PushValue[]; shared: Record<string, string>; existingMode?: "separate" | "repush"; amendShipmentIdBySubitemId?: Record<string, string> };
const ALLOWED_ROLES = new Set(["pm", "admin", "director", "dev"]);

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { data: profile } = await supabase.from("profiles").select("id, role, full_name, email").eq("id", user.id).single();
        if (!profile || !ALLOWED_ROLES.has(profile.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const body = await request.json() as Body;
        const ids = [...new Set((body.subitemIds ?? []).filter(Boolean))];
        if (!ids.length) return NextResponse.json({ error: "Select at least one subitem." }, { status: 400 });

        const { data: subitems, error } = await supabaseAdmin
            .from("subitems")
            .select("id, client_id, name, shipper_id, shipper")
            .in("id", ids);
        if (error || (subitems?.length ?? 0) !== ids.length) return NextResponse.json({ error: error?.message ?? "One or more selected subitems no longer exist." }, { status: 400 });

        const { data: shippers, error: shippersError } = await supabaseAdmin.from("shippers").select("id, name");
        if (shippersError) return NextResponse.json({ error: shippersError.message }, { status: 500 });
        const normalizedShippers = new Map((shippers ?? []).map((shipper) => [String(shipper.name ?? "").trim().toLowerCase(), shipper.id]));
        const resolveShipper = (item: { shipper_id: string | null; shipper: string | null }) => item.shipper_id ?? normalizedShippers.get(String(item.shipper ?? "").replace(/\s+-\s+(sea|air)\s*$/i, "").trim().toLowerCase()) ?? null;
        const clientIds = new Set(subitems!.map((item) => item.client_id).filter(Boolean));
        const shipperIds = new Set(subitems!.map(resolveShipper).filter(Boolean));
        if (clientIds.size !== 1) return NextResponse.json({ error: "Combined shipments can only include subitems from the same client." }, { status: 400 });
        if (shipperIds.size !== 1 || ![...shipperIds][0]) return NextResponse.json({ error: "Combined shipments require all selected subitems to use the same shipper." }, { status: 400 });

        const values = new Map((body.values ?? []).map((value) => [value.subitemId, value]));
        const shared = body.shared ?? {};
        const requiredShared = ["info_provided_date", "delivery_info", "sea_or_air"];
        if (requiredShared.some((key) => !shared[key]?.trim())) return NextResponse.json({ error: "Complete the shared shipment date, address, and Sea/Air fields." }, { status: 400 });

        // The workbook is now the only destination for a combined push. Do
        // not inspect or amend historical shipment records: every confirmed
        // push creates fresh, grouped spreadsheet rows.
        const workbookActor = profile.full_name?.trim() || profile.email || user.email || user.id;
        const rowsForWorkbook = ids.map((id) => {
            const value = values.get(id);
            const source = subitems!.find((item) => item.id === id)!;
            if (!value?.cn_tracking_no?.trim() || !value.qty?.trim() || !value.up?.trim()) throw new Error(`Complete CN Tracking, Qty, and Unit Price for ${source.name || "each item"}.`);
            const qty = Number(value.qty);
            const up = Number(value.up);
            if (!Number.isFinite(qty) || !Number.isFinite(up)) throw new Error("Qty and Unit Price must be numbers.");
            return {
                sourceSubitemId: id,
                plannedFor: shared.info_provided_date,
                values: {
                    serial_number: shared.serial_number || null, waybill_date: shared.waybill_date || null, waybill_number: shared.waybill_number || null,
                    pieces: shared.pieces || null, chargeable_weight_kg: shared.chargeable_weight_kg || null, destination: shared.destination || null,
                    freight_unit_price: shared.freight_unit_price || null, gst: shared.gst || null, other_fees: shared.other_fees || null,
                    channel: shared.channel || null, logistics_remarks: shared.logistics_remarks || null, ic: workbookActor,
                    info_provided_date: shared.info_provided_date, cn_tracking_no: value.cn_tracking_no, cartons: value.cartons || null,
                    item_name: source.name || null, delivery_info: shared.delivery_info, qty, up, sea_or_air: shared.sea_or_air,
                    tax_refund: shared.tax_refund || null, shipper_remarks: value.shipper_remarks || null,
                    samples_by_air: value.samples_by_air || null, samples_by_sea: value.samples_by_sea || null,
                    air_received: value.air_received || null, sea_received: value.sea_received || null,
                },
            };
        });
        const targetShipperId = [...shipperIds][0] as string;
        const workbookShipperName = shippers?.find((shipper) => shipper.id === targetShipperId)?.name ?? "Shipper";
        const createdRows = await createCrmSpreadsheetRows({ shipperId: targetShipperId, shipperName: workbookShipperName, createdBy: user.id, rows: rowsForWorkbook });
        const shipmentGroupId = crypto.randomUUID();
        const { error: groupError } = await supabaseAdmin.from("shipper_spreadsheet_rows").update({ shipment_group_id: shipmentGroupId }).in("id", createdRows.map((row) => row.id));
        if (groupError) throw groupError;
        const workbookId = createdRows[0]?.workbook_id;
        const { data: workbookRows, error: workbookRowsError } = workbookId
            ? await supabaseAdmin.from("shipper_spreadsheet_rows").select("id, sort_key").eq("workbook_id", workbookId).order("sort_key", { ascending: true }).order("id", { ascending: true })
            : { data: [], error: null };
        if (workbookRowsError) throw workbookRowsError;
        const positions = new Map((workbookRows ?? []).map((row, index) => [row.id, index + 1]));
        const legacyProjection = rowsForWorkbook.map((row) => ({
            subitem_id: row.sourceSubitemId,
            client_id: subitems!.find((item) => item.id === row.sourceSubitemId)?.client_id ?? null,
            shipper_id: targetShipperId,
            pushed_by: user.id,
            ...row.values,
        }));
        const { error: legacyError } = await supabaseAdmin.from("shipper_view_rows").upsert(legacyProjection, { onConflict: "subitem_id" });
        if (legacyError) throw legacyError;
        await Promise.all(rowsForWorkbook.map((row) => supabaseAdmin.from("subitems").update({ cn_tracking: row.values.cn_tracking_no }).eq("id", row.sourceSubitemId)));
        await supabaseAdmin.from("activity_log").insert(rowsForWorkbook.map((row) => ({ client_id: subitems!.find((item) => item.id === row.sourceSubitemId)?.client_id ?? null, subitem_id: row.sourceSubitemId, actor_name: workbookActor, action: "shipper_pushed", subitem_name: row.values.item_name, title: "pushed as part of a grouped spreadsheet shipment", meta: { shipperId: targetShipperId, shipperName: workbookShipperName, spreadsheetShipmentGroupId: shipmentGroupId, combined: true }, created_at: new Date().toISOString() })));
        return NextResponse.json({ ok: true, spreadsheetRowsCreated: createdRows.length, spreadsheetPushes: [{ shipperId: targetShipperId, workbookName: `${workbookShipperName} workbook`, rowNumbers: createdRows.map((row) => positions.get(row.id)).filter((row): row is number => typeof row === "number") }] }, { status: 201 });

        const items = ids.map((id) => {
            const value = values.get(id);
            const source = subitems!.find((item) => item.id === id)!;
            if (!value?.cn_tracking_no?.trim() || !value.qty?.trim() || !value.up?.trim()) throw new Error(`Complete CN Tracking, Qty, and Unit Price for ${source.name || "each item"}.`);
            const quantity = Number(value.qty);
            const unitPrice = Number(value.up);
            if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) throw new Error("Qty and Unit Price must be numbers.");
            return {
                subitemId: id,
                clientId: source.client_id,
                lineType: "subitem_delivery" as const,
                displayName: source.name ?? "",
                quantity,
                unitPrice,
                declaredValue: quantity * unitPrice,
                cnTrackingNo: value.cn_tracking_no || null,
                cartons: value.cartons ? Number(value.cartons) : null,
                samplesByAir: value.samples_by_air || null,
                samplesBySea: value.samples_by_sea || null,
                airReceived: value.air_received || null,
                seaReceived: value.sea_received || null,
                remarks: value.shipper_remarks || null,
            };
        });

        const input: ShipmentInput = {
            shipperId: [...shipperIds][0], kind: "shipment", dateOfSubmission: shared.info_provided_date,
            cnTrackingNo: null, cartons: null,
            // @ts-expect-error Legacy shipment path is intentionally unreachable after the workbook return above.
            deliveryInfo: shared.delivery_info, seaOrAir: shared.sea_or_air as ShipmentInput["seaOrAir"], taxRefund: shared.tax_refund === "退" || shared.tax_refund === "X" ? shared.tax_refund : undefined,
            samplesByAir: shared.samples_by_air || null, samplesBySea: shared.samples_by_sea || null,
            ic: profile!.full_name?.trim() || profile!.email || user!.email || user!.id,
            serialNumber: shared.serial_number || null, waybillDate: shared.waybill_date || null, waybillNumber: shared.waybill_number || null,
            pieces: shared.pieces ? Number(shared.pieces) : null, chargeableWeightKg: shared.chargeable_weight_kg ? Number(shared.chargeable_weight_kg) : null,
            destination: shared.destination || null, freightUnitPrice: shared.freight_unit_price ? Number(shared.freight_unit_price) : null,
            gst: shared.gst ? Number(shared.gst) : null, otherFees: shared.other_fees ? Number(shared.other_fees) : null, channel: shared.channel || null, items,
        };
        const amendments = body.amendShipmentIdBySubitemId ?? {};
        if (Object.keys(amendments).length) {
            const selectedIds = Object.values(amendments);
            const { data: existingItems, error: existingError } = await supabaseAdmin.from("shipper_shipment_items").select("shipment_id, subitem_id").in("shipment_id", selectedIds).in("subitem_id", ids);
            if (existingError) return NextResponse.json({ error: existingError?.message }, { status: 500 });
            for (const [subitemId, shipmentId] of Object.entries(amendments)) {
                if (!(existingItems ?? []).some((item) => item.subitem_id === subitemId && item.shipment_id === shipmentId)) return NextResponse.json({ error: "Choose a valid past shipment for every amendment." }, { status: 400 });
            }
        }
        const separateItems = items.filter((item) => !amendments[item.subitemId!]);
        const created = separateItems.length ? await createShipment({ ...input, items: separateItems }, user!.id) : null;
        for (const [subitemId, shipmentId] of Object.entries(amendments)) {
            const item = items.find((candidate) => candidate.subitemId === subitemId)!;
            const { error: shipmentError } = await supabaseAdmin.from("shipper_shipments").update({
                date_of_submission: input.dateOfSubmission, delivery_info: input.deliveryInfo,
                sea_or_air: input.seaOrAir, tax_refund: input.taxRefund, updated_at: new Date().toISOString(),
            }).eq("id", shipmentId);
            if (shipmentError) return NextResponse.json({ error: shipmentError?.message }, { status: 500 });
            const { error: itemError } = await supabaseAdmin.from("shipper_shipment_items").update({
                display_name: item.displayName, quantity: item.quantity, unit_price: item.unitPrice, declared_value: item.declaredValue,
                cn_tracking_no: item.cnTrackingNo, cartons: item.cartons, samples_by_air: item.samplesByAir,
                samples_by_sea: item.samplesBySea, air_received: item.airReceived, sea_received: item.seaReceived,
                remarks: item.remarks, updated_at: new Date().toISOString(),
            }).eq("shipment_id", shipmentId).eq("subitem_id", subitemId);
            if (itemError) return NextResponse.json({ error: itemError?.message }, { status: 500 });
        }
        await Promise.all(ids.map((id) => supabaseAdmin.from("subitems").update({ cn_tracking: values.get(id)!.cn_tracking_no }).eq("id", id)));
        const actor = input.ic!;
        const targetShipperName = shippers?.find((shipper) => shipper.id === input.shipperId)?.name ?? "Shipper";
        const spreadsheetRows = await createCrmSpreadsheetRows({
            shipperId: input.shipperId,
            shipperName: targetShipperName,
            createdBy: user!.id,
            rows: items.map((item) => ({
                sourceSubitemId: item.subitemId!,
                plannedFor: shared.info_provided_date,
                values: {
                    serial_number: shared.serial_number || null,
                    waybill_date: shared.waybill_date || null,
                    waybill_number: shared.waybill_number || null,
                    pieces: shared.pieces || null,
                    chargeable_weight_kg: shared.chargeable_weight_kg || null,
                    destination: shared.destination || null,
                    freight_unit_price: shared.freight_unit_price || null,
                    freight_cost: null,
                    gst: shared.gst || null,
                    other_fees: shared.other_fees || null,
                    total_cost: null,
                    channel: shared.channel || null,
                    logistics_remarks: shared.logistics_remarks || null,
                    ic: actor,
                    info_provided_date: shared.info_provided_date,
                    cn_tracking_no: item.cnTrackingNo,
                    cartons: item.cartons,
                    item_name: item.displayName,
                    delivery_info: shared.delivery_info,
                    qty: item.quantity,
                    up: item.unitPrice,
                    value: item.declaredValue,
                    sea_or_air: shared.sea_or_air,
                    tax_refund: shared.tax_refund || null,
                    shipper_remarks: item.remarks,
                    samples_by_air: item.samplesByAir,
                    samples_by_sea: item.samplesBySea,
                    air_received: item.airReceived,
                    sea_received: item.seaReceived,
                },
            })),
        });
        await supabaseAdmin.from("activity_log").insert(items.map((item) => ({ client_id: item.clientId, subitem_id: item.subitemId, actor_name: actor, action: "shipper_pushed", subitem_name: item.displayName, title: amendments[item.subitemId!] ? "amended a previous shipment push" : "pushed as part of a combined shipment", meta: { shipmentId: amendments[item.subitemId!] ?? created?.shipment.id ?? null, combined: true, existingMode: amendments[item.subitemId!] ? "amend" : "separate" }, created_at: new Date().toISOString() })));
        return NextResponse.json({ shipment: created?.shipment ?? null, items: created?.items ?? [], spreadsheetRowsCreated: spreadsheetRows.length, amendedSubitemIds: Object.keys(amendments) }, { status: 201 });
    } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Could not create the combined shipment." }, { status: 400 }); }
}

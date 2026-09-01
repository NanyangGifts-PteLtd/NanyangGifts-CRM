import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_IMPORTANT_NOTES } from "@/components/Important-Notes";

type CreateOcfBody = {
    clientId: string;
    estimatedDeliveryNotes?: string | null;
    itemUploads: Array<{
        subitemId: string;
        imagePath: string | null;
        needBy: string | null;
    }>;
};

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

        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (String(profile?.role ?? "").trim().toLowerCase() === "pm") {
            return NextResponse.json({ error: "Generating OCF is for Sales" }, { status: 403 });
        }

        const body = (await req.json()) as CreateOcfBody;
        const { clientId, estimatedDeliveryNotes, itemUploads } = body;

        if (!clientId) {
            return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
        }

        if (!Array.isArray(itemUploads)) {
            return NextResponse.json({ error: "itemUploads must be an array" }, { status: 400 });
        }

        const { data: client, error: clientError } = await supabase
            .from("clients")
            .select(`
        id,
        name,
        company,
        client_assignees (
            client_id,
            user_id,
            assigned_at,
            assigned_by,
            profiles (
            id,
            email,
            full_name,
            contact_number
            )
        )
    `)
            .eq("id", clientId)
            .single();

        if (clientError || !client) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        const { data: awardedSubitems, error: subitemsError } = await supabase
            .from("subitems")
            .select("id, client_id, name, qty, description, status, timeline_rows")
            .eq("client_id", clientId)
            .eq("status", "Awarded")
            .order("position");

        if (subitemsError) {
            return NextResponse.json({ error: subitemsError.message }, { status: 500 });
        }

        if (!awardedSubitems || awardedSubitems.length === 0) {
            return NextResponse.json(
                { error: "No awarded subitems found for this client" },
                { status: 400 }
            );
        }

        const { data: importantNotesSetting, error: importantNotesError } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "ocf_important_notes")
            .maybeSingle();

        if (importantNotesError) {
            return NextResponse.json({ error: importantNotesError.message }, { status: 500 });
        }

        const importantNotes = importantNotesSetting?.value?.trim() || DEFAULT_IMPORTANT_NOTES;

        const assignees =
            client.client_assignees?.map((row: any) => row.profiles).filter(Boolean) ?? [];

        const defaultSalesperson =
            assignees.find((a: any) => a.id === user.id) ?? assignees[0] ?? null;

        const awardedIds = new Set(awardedSubitems.map((s) => s.id));
        if (itemUploads.length === 0) {
            return NextResponse.json({ error: "Select at least one awarded subitem for this OCF" }, { status: 400 });
        }
        const uploadMap = new Map(itemUploads.map((u) => [u.subitemId, u]));

        for (const upload of itemUploads) {
            if (!awardedIds.has(upload.subitemId)) {
                return NextResponse.json(
                    { error: "itemUploads contains an invalid subitemId" },
                    { status: 400 }
                );
            }
            if (!upload.imagePath) {
                return NextResponse.json({ error: "Every included subitem needs an uploaded image" }, { status: 400 });
            }
            if (upload.needBy !== "ASAP" && !/^\d{4}-\d{2}-\d{2}$/.test(String(upload.needBy ?? ""))) {
                return NextResponse.json({ error: "Every included subitem needs a Need by Date or ASAP" }, { status: 400 });
            }
        }

        const { data: ocf, error: ocfError } = await supabase
            .from("order_confirmations")
            .insert({
                client_id: client.id,
                generated_by: user.id,
                client_name_snapshot: client.name,
                company_snapshot: client.company,
                salesperson_ids: assignees.map((a: any) => a.id),
                salesperson_name: defaultSalesperson?.full_name ?? "",
                salesperson_email: defaultSalesperson?.email ?? "",
                salesperson_contact_number: defaultSalesperson?.contact_number ?? "",
                estimated_delivery_notes: estimatedDeliveryNotes ?? null,
                important_notes: importantNotes,
                status: "draft",
            })
            .select()
            .single();

        if (ocfError || !ocf) {
            return NextResponse.json(
                { error: ocfError?.message ?? "Failed to create OCF" },
                { status: 500 }
            );
        }

        const itemRows = awardedSubitems.filter((item) => uploadMap.has(item.id)).map((item) => ({
            order_confirmation_id: ocf.id,
            subitem_id: item.id,
            qty: item.qty,
            item_name: item.name,
            remarks: item.description,
            image_path: uploadMap.get(item.id)?.imagePath ?? null,
            need_by_date: uploadMap.get(item.id)?.needBy ?? null,
        }));

        const internalUrl = `/app/order-confirmations/${ocf.id}`;
        const clientUrl = `/ocf/${ocf.client_token}`;

        const { error: activityLogError } = await supabase
            .from("activity_log")
            .insert({
                client_id: client.id,
                actor_name: defaultSalesperson?.email ?? user.email ?? "Unknown user",
                action: "ocf_created",
                title: "Order Confirmation Form created",
                description: ` for ${client.name ?? "client"}`,
                link: internalUrl,
                meta: {
                    ocfId: ocf.id,
                    clientUrl,
                    generatedBy: user.id,
                },
            });

        if (activityLogError) {
            console.error("Activity log insert failed:", activityLogError);

            return NextResponse.json(
                { error: `Failed to create activity log: ${activityLogError.message}` },
                { status: 500 }
            );
        }

        const { error: itemsError } = await supabase
            .from("order_confirmation_items")
            .insert(itemRows);

        if (itemsError) {
            await supabase.from("order_confirmations").delete().eq("id", ocf.id);

            return NextResponse.json(
                { error: itemsError.message ?? "Failed to create OCF items" },
                { status: 500 }
            );
        }

        const timelineUpdates = await Promise.all(itemUploads.map(async (upload) => {
            const subitem = awardedSubitems.find((item) => item.id === upload.subitemId);
            if (!subitem) return null;
            const rows = Array.isArray(subitem.timeline_rows) ? subitem.timeline_rows : [];
            const nbdIndex = rows.findIndex((row: any) => String(row?.name ?? "").trim().toLowerCase() === "nbd");
            const nbdRow = {
                id: crypto.randomUUID(), name: "NBD", person: "", remarks: "", numOfCartons: "", subProgress: "", timelineStart: "", timelineEnd: "", duration: "", dependency: "",
            };
            const nextNbd = {
                ...(nbdIndex >= 0 ? rows[nbdIndex] : nbdRow),
                timelineStart: upload.needBy === "ASAP" ? "" : upload.needBy,
                remarks: upload.needBy === "ASAP" ? "ASAP" : (String((nbdIndex >= 0 ? rows[nbdIndex]?.remarks : "") ?? "").trim().toLowerCase() === "asap" ? "" : (nbdIndex >= 0 ? rows[nbdIndex]?.remarks ?? "" : "")),
            };
            const timeline_rows = nbdIndex >= 0 ? rows.map((row: any, index: number) => index === nbdIndex ? nextNbd : row) : [...rows, nextNbd];
            return supabase.from("subitems").update({ timeline_rows }).eq("id", upload.subitemId);
        }));
        const timelineError = timelineUpdates.find((result) => result?.error)?.error;
        if (timelineError) {
            return NextResponse.json({ error: `OCF was created, but the NBD timeline could not be updated: ${timelineError.message}` }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            ocfId: ocf.id,
            internalUrl,
            clientUrl,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message ?? "Unexpected server error" },
            { status: 500 }
        );
    }
}

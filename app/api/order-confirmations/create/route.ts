import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_IMPORTANT_NOTES } from "@/components/Important-Notes";

type CreateOcfBody = {
    clientId: string;
    estimatedDeliveryNotes?: string | null;
    itemUploads: Array<{
        subitemId: string;
        imagePath: string | null;
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
            .select("id, client_id, name, qty, description, status")
            .eq("client_id", clientId)
            .eq("status", "Awarded");

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
        const uploadMap = new Map(itemUploads.map((u) => [u.subitemId, u.imagePath]));

        for (const subitem of awardedSubitems) {
            if (!uploadMap.has(subitem.id)) {
                return NextResponse.json(
                    { error: `Missing uploaded image for awarded subitem "${subitem.name}"` },
                    { status: 400 }
                );
            }
        }

        for (const upload of itemUploads) {
            if (!awardedIds.has(upload.subitemId)) {
                return NextResponse.json(
                    { error: "itemUploads contains an invalid subitemId" },
                    { status: 400 }
                );
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

        const itemRows = awardedSubitems.map((item) => ({
            order_confirmation_id: ocf.id,
            subitem_id: item.id,
            qty: item.qty,
            item_name: item.name,
            remarks: item.description,
            image_path: uploadMap.get(item.id) ?? null,
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
                description: `OCF generated for ${client.name ?? "client"}`,
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
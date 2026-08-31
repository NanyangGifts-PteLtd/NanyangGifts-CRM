import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const ocfId = body?.ocfId;
        const estimatedDeliveryNotes = body?.estimatedDeliveryNotes ?? "";
        const clientNameSnapshot = body?.clientNameSnapshot;
        const companySnapshot = body?.companySnapshot;
        const sameAddressForAllItems = body?.sameAddressForAllItems;
        const items = Array.isArray(body?.items) ? body.items : [];

        if (!ocfId) {
            return NextResponse.json({ error: "Missing ocfId" }, { status: 400 });
        }

        const supabase = await createClient();

        const { data: ocf, error: ocfLookupError } = await supabase
            .from("order_confirmations")
            .select("client_id")
            .eq("id", ocfId)
            .single();
        if (ocfLookupError || !ocf) {
            return NextResponse.json({ error: "Order confirmation not found" }, { status: 404 });
        }

        const { error: ocfError } = await supabase
            .from("order_confirmations")
            .update({
                estimated_delivery_notes: estimatedDeliveryNotes,
                ...(typeof clientNameSnapshot === "string" ? { client_name_snapshot: clientNameSnapshot } : {}),
                ...(typeof companySnapshot === "string" ? { company_snapshot: companySnapshot } : {}),
                ...(typeof sameAddressForAllItems === "boolean" ? { same_address_for_all_items: sameAddressForAllItems } : {}),
            })
            .eq("id", ocfId);

        if (ocfError) {
            return NextResponse.json({ error: ocfError.message }, { status: 500 });
        }

        for (const item of items) {
            const { error: itemError } = await supabase
                .from("order_confirmation_items")
                .update({
                    remarks: item.remarks ?? "",
                    delivery_name: item.delivery_name ?? null,
                    delivery_address: item.delivery_address ?? null,
                    delivery_contact_number: item.delivery_contact_number ?? null,
                    delivery_remarks: item.delivery_remarks ?? null,

                })
                .eq("id", item.id)
                .eq("order_confirmation_id", ocfId);

            if (itemError) {
                return NextResponse.json({ error: itemError.message }, { status: 500 });
            }
        }
for (const item of items) {
    const { error: shipperUpdateError } = await supabase
        .from("shipper_view_rows")
        .update({
            delivery_info: [
                item.delivery_contact_number ? `Contact: ${item.delivery_contact_number}` : null,
                item.delivery_address ? `Address: ${item.delivery_address}` : null,
            ].filter(Boolean).join("\n") || null,
        })
        .eq("subitem_id", item.subitem_id);

    if (shipperUpdateError) {
        console.error("Failed to update shipper view row:", shipperUpdateError);
    }
}

        await supabase.from("activity_log").insert({
            client_id: ocf.client_id,
            subitem_id: null,
            actor_name: "CRM user",
            action: "ocf_updated",
            field_name: null,
            old_value: null,
            new_value: null,
            title: "Order Confirmation Form updated",
            description: "Internal OCF details were updated.",
            link: `/app/order-confirmations/${ocfId}`,
            meta: { ocfId },
            created_at: new Date().toISOString(),
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "Unexpected server error" },
            { status: 500 }
        );
    }
    
}

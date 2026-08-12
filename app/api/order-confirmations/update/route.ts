import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const ocfId = body?.ocfId;
        const estimatedDeliveryNotes = body?.estimatedDeliveryNotes ?? "";
        const items = Array.isArray(body?.items) ? body.items : [];

        if (!ocfId) {
            return NextResponse.json({ error: "Missing ocfId" }, { status: 400 });
        }

        const supabase = await createClient();

        const { error: ocfError } = await supabase
            .from("order_confirmations")
            .update({
                estimated_delivery_notes: estimatedDeliveryNotes,
                client_submitted_at: new Date().toISOString(),
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
                    delivery_address: item.delivery_address ?? null,
                    delivery_contact_number: item.delivery_contact_number ?? null,

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

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "Unexpected server error" },
            { status: 500 }
        );
    }
    
}
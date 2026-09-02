import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "shipper-attachments";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file");
        const shipmentId = String(formData.get("shipmentId") ?? "");
        const shipmentItemId = String(formData.get("shipmentItemId") ?? "");
        const shipperId = String(formData.get("shipperId") ?? "");
        const shipperToken = String(formData.get("shipperToken") ?? "");

        if (!(file instanceof File) || (!shipmentId && !shipmentItemId)) {
            return NextResponse.json({ error: "An image and shipment target are required" }, { status: 400 });
        }
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
        }
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: "Images must be 10 MB or smaller" }, { status: 400 });
        }

        let resolvedShipperId = shipperId || null;
        if (!resolvedShipperId && shipperToken) {
            const { data: shipper, error } = await supabase
                .from("shippers")
                .select("id")
                .eq("token", shipperToken)
                .maybeSingle();
            if (error) throw error;
            resolvedShipperId = shipper?.id ?? null;
        }
        if (!resolvedShipperId) {
            return NextResponse.json({ error: "A valid shipper is required" }, { status: 400 });
        }

        const { data: row, error: rowError } = shipmentId
            ? await supabase.from("shipper_shipments").select("id, shipper_id").eq("id", shipmentId).eq("shipper_id", resolvedShipperId).maybeSingle()
            : await supabase.from("shipper_shipment_items").select("id, shipment:shipper_shipments(shipper_id)").eq("id", shipmentItemId).maybeSingle();
        if (rowError) throw rowError;
        const itemShipperId = (row as any)?.shipment?.shipper_id ?? (row as any)?.shipment?.[0]?.shipper_id;
        if (!row || (!shipmentId && itemShipperId !== resolvedShipperId)) return NextResponse.json({ error: "Shipment target not found" }, { status: 404 });

        const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${resolvedShipperId}/shipments/${shipmentId || shipmentItemId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(path, Buffer.from(await file.arrayBuffer()), {
                contentType: file.type,
                upsert: false,
            });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return NextResponse.json({ ok: true, url: data.publicUrl });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message ?? "Failed to upload image" }, { status: 500 });
    }
}

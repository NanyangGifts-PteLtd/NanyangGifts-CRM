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
        const subitemId = String(formData.get("subitemId") ?? "");
        const shipperId = String(formData.get("shipperId") ?? "");
        const shipperToken = String(formData.get("shipperToken") ?? "");

        if (!(file instanceof File) || !subitemId) {
            return NextResponse.json({ error: "An image and subitemId are required" }, { status: 400 });
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

        const { data: row, error: rowError } = await supabase
            .from("shipper_view_rows")
            .select("subitem_id, shipper_id")
            .eq("subitem_id", subitemId)
            .eq("shipper_id", resolvedShipperId)
            .maybeSingle();
        if (rowError) throw rowError;
        if (!row) return NextResponse.json({ error: "Shipper view row not found" }, { status: 404 });

        const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${resolvedShipperId}/${subitemId}/${crypto.randomUUID()}.${extension}`;
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

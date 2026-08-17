import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "shipper-attachments";

export async function POST(req: NextRequest) {
    try {
        const { url } = (await req.json()) as { url?: string };
        if (!url) return NextResponse.json({ error: "Image URL is required" }, { status: 400 });

        const marker = `/storage/v1/object/public/${BUCKET}/`;
        const markerIndex = url.indexOf(marker);
        if (markerIndex === -1) {
            return NextResponse.json({ error: "Invalid shipper attachment URL" }, { status: 400 });
        }

        const path = decodeURIComponent(url.slice(markerIndex + marker.length));
        const { error } = await supabase.storage.from(BUCKET).remove([path]);
        if (error) throw error;

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message ?? "Failed to remove image" }, { status: 500 });
    }
}

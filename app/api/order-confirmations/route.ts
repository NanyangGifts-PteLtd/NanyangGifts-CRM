import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const clientId = new URL(request.url).searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
        .from("order_confirmations")
        .select("id, generated_at, client_signed_at, status, client_name_snapshot")
        .eq("client_id", clientId)
        .order("generated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json((data ?? []).map((ocf) => ({
        id: ocf.id,
        name: `Order Confirmation Form${ocf.client_name_snapshot ? ` - ${ocf.client_name_snapshot}` : ""}`,
        url: `/app/order-confirmations/${ocf.id}`,
        createdAt: ocf.generated_at,
        signed: Boolean(ocf.client_signed_at) || ocf.status === "submitted",
    })));
}

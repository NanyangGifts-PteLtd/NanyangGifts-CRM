import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "shipper-attachments";
const SHIPMENT_STAFF_ROLES = new Set(["pm", "admin", "director", "dev"]);

function pathFromReference(reference: string) {
  const publicMarker = `/storage/v1/object/public/${BUCKET}/`;
  const privateMarker = "/api/shipper/image?path=";
  if (reference.includes(privateMarker)) {
    return decodeURIComponent(reference.split(privateMarker)[1]?.split("&")[0] ?? "");
  }
  if (reference.includes(publicMarker)) {
    return decodeURIComponent(reference.slice(reference.indexOf(publicMarker) + publicMarker.length));
  }
  return reference;
}

export async function POST(request: NextRequest) {
  try {
    const { url, path: suppliedPath } = (await request.json()) as { url?: string; path?: string };
    const path = pathFromReference(suppliedPath ?? url ?? "");
    const shipperId = path.split("/")[0];
    if (!path || !/^[0-9a-f-]{36}$/i.test(shipperId)) {
      return NextResponse.json({ error: "Invalid shipper attachment" }, { status: 400 });
    }

    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await sessionClient.from("profiles").select("role, shipper_id").eq("id", user.id).maybeSingle();
    const role = profile?.role?.toLowerCase() ?? "";
    if (!SHIPMENT_STAFF_ROLES.has(role) && (role !== "shipper" || profile?.shipper_id !== shipperId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove image" },
      { status: 500 },
    );
  }
}

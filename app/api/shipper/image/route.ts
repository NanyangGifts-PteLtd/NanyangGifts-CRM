import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "shipper-attachments";
const SHIPMENT_STAFF_ROLES = new Set(["pm", "admin", "director", "dev"]);

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const shipperId = path.split("/")[0];
  if (!/^[0-9a-f-]{36}$/i.test(shipperId)) {
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

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "Attachment not found" }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl);
}

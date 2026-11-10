import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "shipper-attachments";
const SHIPMENT_STAFF_ROLES = new Set(["pm", "admin", "director", "dev"]);

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await sessionClient
      .from("profiles")
      .select("role, shipper_id")
      .eq("id", user.id)
      .maybeSingle();
    const role = profile?.role?.toLowerCase() ?? "";
    const isStaff = SHIPMENT_STAFF_ROLES.has(role);
    const formData = await request.formData();
    const file = formData.get("file");
    const spreadsheetRowId = String(formData.get("spreadsheetRowId") ?? "");
    const requestedShipperId = String(formData.get("shipperId") ?? "");

    if (!(file instanceof File) || !spreadsheetRowId) {
      return NextResponse.json({ error: "An image and attachment target are required" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Images must be 10 MB or smaller" }, { status: 400 });
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("shipper_spreadsheet_rows")
      .select("id, workbook:shipper_workbooks(shipper_id)")
      .eq("id", spreadsheetRowId)
      .maybeSingle();
    if (targetError) throw targetError;
    const workbook = (target as { workbook?: { shipper_id?: string | null } | Array<{ shipper_id?: string | null }> } | null)?.workbook;
    const targetShipperId =
      (Array.isArray(workbook) ? workbook[0]?.shipper_id : workbook?.shipper_id) ??
      null;
    if (!target || !targetShipperId || (requestedShipperId && requestedShipperId !== targetShipperId)) {
      return NextResponse.json({ error: "Shipment target not found" }, { status: 404 });
    }
    if (!isStaff && (role !== "shipper" || profile?.shipper_id !== targetShipperId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${targetShipperId}/spreadsheet/${spreadsheetRowId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(
      path,
      Buffer.from(await file.arrayBuffer()),
      { contentType: file.type, upsert: false },
    );
    if (uploadError) throw uploadError;

    return NextResponse.json({ ok: true, path, url: `/api/shipper/image?path=${encodeURIComponent(path)}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload image" },
      { status: 500 },
    );
  }
}

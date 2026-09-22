import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShipperSubitems } from "@/lib/shipper/get-shipper-subitems";
import { getShipperStagingRows } from "@/lib/shipper/get-shipper-staging-rows";
import { getShipperShipments } from "@/lib/shipper/shipments";

const ALLOWED_ROLES = new Set(["pm", "admin", "director", "dev"]);

export async function GET(request: NextRequest) {
  const shipperId = request.nextUrl.searchParams.get("shipperId");
  if (!shipperId) return NextResponse.json({ error: "shipperId is required" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!ALLOWED_ROLES.has(String(profile?.role ?? "").toLowerCase())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const [rows, stagingRows, shipments] = await Promise.all([
      getShipperSubitems(shipperId),
      getShipperStagingRows(shipperId),
      getShipperShipments(shipperId),
    ]);
    return NextResponse.json({ rows, stagingRows, shipments });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load shipper data." }, { status: 500 });
  }
}

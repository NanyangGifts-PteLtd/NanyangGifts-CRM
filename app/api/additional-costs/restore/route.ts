import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);
const BIN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = String(profile?.role ?? "").toLowerCase();
    if (!INTERNAL_ROLES.has(role)) throw new Error("Forbidden");
    const body = await request.json();
    const subitemId = String(body?.subitemId ?? "");
    if (!subitemId) throw new Error("A linked Payment Voucher subitem is required.");

    const { data: subitem, error: subitemError } = await supabaseAdmin
      .from("subitems")
      .select("id, client_id, deleted_at, custom_fields")
      .eq("id", subitemId)
      .maybeSingle();
    if (subitemError || !subitem?.deleted_at)
      throw new Error("This subitem is no longer in the Bin.");
    if (Date.now() - new Date(subitem.deleted_at).getTime() >= BIN_RETENTION_MS)
      throw new Error("The 30-day Bin retention period has ended.");
    const voucherId = String(subitem.custom_fields?.additionalCostId ?? "");
    if (!voucherId) throw new Error("This subitem is not linked to a Payment Voucher.");

    const { data: voucher, error: voucherError } = await supabaseAdmin
      .from("additional_costs")
      .select("id, client_id, deleted_at")
      .eq("id", voucherId)
      .maybeSingle();
    if (voucherError || !voucher?.deleted_at)
      throw new Error("The linked Payment Voucher is no longer available in the Bin.");
    if (voucher.client_id !== subitem.client_id)
      throw new Error("The linked Payment Voucher belongs to a different client.");

    if (!['admin', 'director'].includes(role)) {
      const { data: assignment, error: assignmentError } = await supabaseAdmin
        .from("client_assignees")
        .select("client_id")
        .eq("client_id", subitem.client_id)
        .eq("user_id", user.id)
        .in("assignment_type", ["people", "pm"])
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) throw new Error("You can only restore payment vouchers for clients assigned to you.");
    }

    const { error: subitemRestoreError } = await supabaseAdmin
      .from("subitems")
      .update({ deleted_at: null, deleted_by: null, deleted_with_client_id: null })
      .eq("id", subitem.id)
      .not("deleted_at", "is", null);
    if (subitemRestoreError) throw subitemRestoreError;
    const { error: voucherRestoreError } = await supabaseAdmin
      .from("additional_costs")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", voucher.id)
      .not("deleted_at", "is", null);
    if (voucherRestoreError) {
      await supabaseAdmin
        .from("subitems")
        .update({ deleted_at: subitem.deleted_at, deleted_by: user.id })
        .eq("id", subitem.id);
      throw voucherRestoreError;
    }
    return NextResponse.json({ ok: true, voucherId: voucher.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment Voucher could not be restored.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400 });
  }
}

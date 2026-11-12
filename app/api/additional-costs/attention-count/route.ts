import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ROLES = new Set(["pm", "admin", "director", "dev"]);
const QUICKBOOKS_BILL_ROLES = new Set(["admin", "director", "dev"]);

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = String(profile?.role ?? "").toLowerCase();
    if (profileError || !ROLES.has(role)) throw new Error("Forbidden");

    const { data: rows, error } = await supabaseAdmin
      .from("additional_costs")
      .select(
        "voucher_group, is_draft, payment_evidence_files, quickbooks_bill_paid",
      )
      .is("deleted_at", null)
      .is("deactivated_at", null);
    if (error) throw error;

    const count = (rows ?? []).filter((row) => {
      if (row.voucher_group === "courier") return false;
      if (
        row.voucher_group === "quickbooks_bills_only" &&
        !QUICKBOOKS_BILL_ROLES.has(role)
      )
        return false;
      if (row.is_draft) return true;
      const evidence = Array.isArray(row.payment_evidence_files)
        ? row.payment_evidence_files
        : [];
      return !evidence.length && !row.quickbooks_bill_paid;
    }).length;

    return NextResponse.json({ count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load count.";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 },
    );
  }
}

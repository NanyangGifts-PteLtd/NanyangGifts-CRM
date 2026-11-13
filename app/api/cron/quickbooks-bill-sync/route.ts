import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { qboRequest } from "@/lib/quickbooks/api";
import { getSystemLabel } from "@/lib/system-labels";

const BILL_NOT_FOUND_ERROR = "ERROR - Could not find Bill";

async function syncCompletedPaymentRequestRow(voucher: {
  voucher_group?: string | null;
  is_draft?: boolean | null;
  payment_request_payment_row_id?: string | null;
  cost?: number | null;
  order_number?: string | null;
  mode_of_payment?: string | null;
  mode_of_payment_option_id?: string | null;
  remarks?: string | null;
}) {
  if (
    voucher.voucher_group !== "payment_requests" ||
    voucher.is_draft ||
    !voucher.payment_request_payment_row_id
  )
    return;
  const paid = await getSystemLabel("payment_received", "payment_received_yes");
  const { error } = await supabaseAdmin
    .from("subitem_payment_rows")
    .update({
      amount: voucher.cost == null ? "" : String(voucher.cost),
      order_number: voucher.order_number ?? "",
      mode_of_payment: voucher.mode_of_payment ?? "",
      mode_of_payment_option_id: voucher.mode_of_payment_option_id ?? null,
      remarks: voucher.remarks ?? "",
      payment_received: true,
      payment_received_label: paid.value,
      payment_received_option_id: paid.id,
    })
    .eq("id", voucher.payment_request_payment_row_id);
  if (error) throw error;
}

function authorized(request: NextRequest) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: vouchers, error } = await supabaseAdmin.from("additional_costs")
    .select("id, quickbooks_bill_id, voucher_group, is_draft, payment_request_payment_row_id, order_number, mode_of_payment, mode_of_payment_option_id, remarks")
    .eq("has_quickbooks_bill", true)
    .not("quickbooks_bill_id", "is", null)
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let synced = 0;
  let failed = 0;
  for (const voucher of vouchers ?? []) {
    try {
      const result = await qboRequest(`/bill/${voucher.quickbooks_bill_id}`, { method: "GET" });
      const bill = result?.Bill;
      if (!bill?.Id) throw new Error("Bill was not found.");
      const cost = (bill.Line ?? [])
        .filter((line: any) => line.DetailType === "AccountBasedExpenseLineDetail")
        .reduce((total: number, line: any) => total + (Number(line.Amount) || 0), 0);
      const hasGstOverride = (bill.TxnTaxDetail?.TaxLine ?? []).some(
        (line: { TaxLineDetail?: { OverrideDeltaAmount?: unknown } }) => line.TaxLineDetail?.OverrideDeltaAmount != null,
      );
      const balance = Number(bill.Balance ?? 0);
      const quickbooksBillBalance = Number.isFinite(balance) ? balance : 0;
      const { data: updatedVoucher, error: updateError } = await supabaseAdmin.from("additional_costs").update({
        cost,
        quickbooks_invoice_number: String(bill.DocNumber ?? ""),
        quickbooks_supplier_id: String(bill.VendorRef?.value ?? ""),
        quickbooks_supplier_name: String(bill.VendorRef?.name ?? ""),
        quickbooks_memo: String(bill.PrivateNote ?? ""),
        quickbooks_overall_gst_override: hasGstOverride
          ? Number(bill.TxnTaxDetail?.TotalTax ?? 0)
          : null,
        quickbooks_bill_sync_error: null,
        quickbooks_bill_balance: quickbooksBillBalance,
        quickbooks_bill_paid: Math.abs(quickbooksBillBalance) < 0.005,
        updated_at: new Date().toISOString(),
      }).eq("id", voucher.id).select("*").single();
      if (updateError) throw updateError;
      await syncCompletedPaymentRequestRow(updatedVoucher);
      const { error: subitemError } = await supabaseAdmin.from("subitems")
        .update({ cost: String(cost) })
        .eq("custom_fields->>additionalCostId", voucher.id)
        .is("deleted_at", null);
      if (subitemError) throw subitemError;
      synced += 1;
    } catch (syncError) {
      failed += 1;
      const { error: updateError } = await supabaseAdmin.from("additional_costs").update({
        quickbooks_bill_sync_error: BILL_NOT_FOUND_ERROR,
        updated_at: new Date().toISOString(),
      }).eq("id", voucher.id);
      if (updateError) console.error("Could not store Bill sync error", voucher.id, updateError.message);
      console.error("QuickBooks Bill sync failed", voucher.id, syncError);
    }
  }
  return NextResponse.json({ ok: true, eligible: vouchers?.length ?? 0, synced, failed });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { qboQuery, qboRequest, qboUploadAttachment } from "@/lib/quickbooks/api";
import { listQuickBooksTaxCodes } from "@/lib/quickbooks/bill-options";
import { ensureQuickBooksBillNumberAvailable } from "@/lib/quickbooks/bill-duplicate-check";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);
const BILL_NOT_FOUND_ERROR = "ERROR - Could not find Bill";

async function setBillSyncError(voucherId: string, error: string | null) {
  const { error: updateError } = await supabaseAdmin.from("additional_costs")
    .update({ quickbooks_bill_sync_error: error, updated_at: new Date().toISOString() })
    .eq("id", voucherId);
  if (updateError) throw updateError;
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not update QuickBooks Bill.";
  return NextResponse.json({ error: message }, { status: /unauthorized/i.test(message) ? 401 : 400 });
}

async function authorisedVoucher(voucherId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = String(profile?.role ?? "").toLowerCase();
  if (!INTERNAL_ROLES.has(role)) throw new Error("Unauthorized");
  const { data: voucher, error } = await supabaseAdmin.from("additional_costs").select("*")
    .eq("id", voucherId).is("deleted_at", null).maybeSingle();
  if (error || !voucher || !voucher.quickbooks_bill_id || !voucher.has_quickbooks_bill)
    throw new Error("This payment voucher does not have a QuickBooks Bill.");
  if (!['admin', 'director', 'dev'].includes(role)) {
    const { data: assignment, error: assignmentError } = await supabaseAdmin.from("client_assignees")
      .select("client_id").eq("client_id", voucher.client_id).eq("user_id", user.id)
      .in("assignment_type", ["people", "pm"]).maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment) throw new Error("You can only edit payment vouchers for clients assigned to you.");
  }
  return { voucher };
}

function lineInput(value: unknown, field: string) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) throw new Error(`${field} must be greater than zero.`);
  return result;
}
const escapeQuery = (value: string) => value.replace(/'/g, "\\'");

async function authorisedLinkVoucher(voucherId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = String(profile?.role ?? "").toLowerCase();
  if (!INTERNAL_ROLES.has(role)) throw new Error("Unauthorized");
  const { data: voucher, error } = await supabaseAdmin.from("additional_costs").select("*").eq("id", voucherId).is("deleted_at", null).maybeSingle();
  if (error || !voucher) throw new Error("Payment voucher not found.");
  if (!['admin', 'director', 'dev'].includes(role)) {
    const { data: assignment } = await supabaseAdmin.from("client_assignees").select("client_id").eq("client_id", voucher.client_id).eq("user_id", user.id).in("assignment_type", ["people", "pm"]).maybeSingle();
    if (!assignment) throw new Error("You can only link Bills for clients assigned to you.");
  }
  return { voucher };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action?: "lookup" | "link"; voucherId?: string; billNumber?: string; billId?: string };
    const { voucher } = await authorisedLinkVoucher(String(body.voucherId ?? ""));
    if (body.action === "lookup") {
      const billNumber = String(body.billNumber ?? "").trim();
      if (!billNumber) throw new Error("Enter a Bill / invoice number.");
      const result = await qboQuery(`SELECT * FROM Bill WHERE DocNumber = '${escapeQuery(billNumber)}'`);
      const bills = result?.QueryResponse?.Bill ?? [];
      const ids = bills.map((bill: any) => String(bill.Id)).filter(Boolean);
      const { data: linked } = ids.length ? await supabaseAdmin.from("additional_costs").select("id, quickbooks_bill_id, trip_id").in("quickbooks_bill_id", ids).is("deleted_at", null) : { data: [] as any[] };
      const linkedById = new Map((linked ?? []).filter((row: any) => row.id !== voucher.id).map((row: any) => [String(row.quickbooks_bill_id), row]));
      return NextResponse.json({ bills: bills.map((bill: any) => ({ id: String(bill.Id), billNumber: String(bill.DocNumber ?? ""), supplierName: String(bill.VendorRef?.name ?? ""), supplierId: String(bill.VendorRef?.value ?? ""), billDate: String(bill.TxnDate ?? ""), dueDate: String(bill.DueDate ?? ""), total: Number(bill.TotalAmt ?? 0), memo: String(bill.PrivateNote ?? ""), alreadyLinked: linkedById.has(String(bill.Id)), linkedVoucherReference: linkedById.get(String(bill.Id))?.trip_id ?? null })) });
    }
    if (body.action !== "link" || !body.billId) throw new Error("Choose a QuickBooks Bill to link.");
    const existing = await supabaseAdmin.from("additional_costs").select("id, trip_id").eq("quickbooks_bill_id", String(body.billId)).is("deleted_at", null).neq("id", voucher.id).maybeSingle();
    if (existing.data) throw new Error(`This QuickBooks Bill is already linked to payment voucher ${existing.data.trip_id || existing.data.id}.`);
    const result = await qboRequest(`/bill/${encodeURIComponent(String(body.billId))}`, { method: "GET" });
    const bill = result?.Bill;
    if (!bill?.Id) throw new Error("QuickBooks Bill could not be found.");
    const total = Number(bill.Line?.filter((line: any) => line.DetailType === "AccountBasedExpenseLineDetail").reduce((sum: number, line: any) => sum + Number(line.Amount ?? 0), 0) ?? 0);
    const hasGstOverride = (bill.TxnTaxDetail?.TaxLine ?? []).some(
      (line: { TaxLineDetail?: { OverrideDeltaAmount?: unknown } }) => line.TaxLineDetail?.OverrideDeltaAmount != null,
    );
    const { data: row, error } = await supabaseAdmin.from("additional_costs").update({ has_quickbooks_bill: true, quickbooks_bill_id: String(bill.Id), quickbooks_bill_sync_error: null, quickbooks_invoice_number: String(bill.DocNumber ?? ""), quickbooks_supplier_id: String(bill.VendorRef?.value ?? ""), quickbooks_supplier_name: String(bill.VendorRef?.name ?? ""), quickbooks_overall_gst_override: hasGstOverride ? Number(bill.TxnTaxDetail?.TotalTax ?? 0) : null, cost: total, updated_at: new Date().toISOString() }).eq("id", voucher.id).select("*").single();
    if (error) throw error;
    await supabaseAdmin.from("subitems").update({ cost: String(total) }).eq("custom_fields->>additionalCostId", voucher.id).is("deleted_at", null);
    return NextResponse.json({ row });
  } catch (error) { return fail(error); }
}

export async function GET(request: NextRequest) {
  try {
    const voucherId = request.nextUrl.searchParams.get("voucherId") ?? "";
    const { voucher } = await authorisedVoucher(voucherId);
    let result: any;
    try {
      result = await qboRequest(`/bill/${voucher.quickbooks_bill_id}`, { method: "GET" });
    } catch {
      await setBillSyncError(voucher.id, BILL_NOT_FOUND_ERROR);
      return NextResponse.json(
        { error: "QuickBooks Bill could not be found.", billSyncError: BILL_NOT_FOUND_ERROR },
        { status: 404 },
      );
    }
    const bill = result?.Bill;
    if (!bill?.Id) {
      await setBillSyncError(voucher.id, BILL_NOT_FOUND_ERROR);
      return NextResponse.json(
        { error: "QuickBooks Bill could not be found.", billSyncError: BILL_NOT_FOUND_ERROR },
        { status: 404 },
      );
    }
    if (voucher.quickbooks_bill_sync_error) await setBillSyncError(voucher.id, null);
    return NextResponse.json({
      voucher,
      bill: {
        supplierId: String(bill.VendorRef?.value ?? ""),
        supplierName: String(bill.VendorRef?.name ?? ""),
        mailingAddress: [bill.VendorAddr?.Line1, bill.VendorAddr?.Line2, bill.VendorAddr?.Line3].filter(Boolean).join("\n"),
        termId: String(bill.SalesTermRef?.value ?? ""),
        billDate: String(bill.TxnDate ?? ""),
        dueDate: String(bill.DueDate ?? ""),
        billNumber: String(bill.DocNumber ?? ""),
        memo: String(bill.PrivateNote ?? ""),
        // The edit form needs the Bill's actual current GST total from
        // QuickBooks, whether it was calculated there or manually overridden.
        overallGstAmount: bill.TxnTaxDetail?.TotalTax == null
          ? ""
          : String(bill.TxnTaxDetail.TotalTax),
        lines: (bill.Line ?? []).filter((line: any) => line.DetailType === "AccountBasedExpenseLineDetail").map((line: any) => ({
          categoryId: String(line.AccountBasedExpenseLineDetail?.AccountRef?.value ?? ""),
          categoryName: String(line.AccountBasedExpenseLineDetail?.AccountRef?.name ?? line.AccountBasedExpenseLineDetail?.AccountRef?.value ?? ""),
          description: String(line.Description ?? ""),
          amount: String(line.Amount ?? ""),
          taxCodeId: String(line.AccountBasedExpenseLineDetail?.TaxCodeRef?.value ?? ""),
        })),
      },
    });
  } catch (error) { return fail(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const formData = await request.formData();
    const rawPayload = formData.get("payload");
    if (typeof rawPayload !== "string") throw new Error("Bill details are required.");
    const body = JSON.parse(rawPayload) as { voucherId?: string; bill?: any };
    const { voucher } = await authorisedVoucher(String(body.voucherId ?? ""));
    const draft = body.bill;
    if (!draft) throw new Error("Bill details are required.");
    let supplierId = String(draft.supplierId ?? "").trim();
    const supplierName = String(draft.supplierName ?? "").trim();
    const billNumber = String(draft.billNumber ?? "").trim();
    const memo = String(draft.memo ?? "").trim();
    if ((!supplierId && !supplierName) || !billNumber || !memo) throw new Error("Supplier, Invoice no., and Memo are required.");
    if (!supplierId) {
      const createdVendor = await qboRequest("/vendor", {
        method: "POST",
        body: JSON.stringify({ DisplayName: supplierName, CompanyName: supplierName }),
      });
      supplierId = String(createdVendor?.Vendor?.Id ?? "");
      if (!supplierId) throw new Error("QuickBooks could not create the new Supplier.");
    }
    await ensureQuickBooksBillNumberAvailable({
      supplierId,
      billNumber,
      excludeBillId: String(voucher.quickbooks_bill_id),
    });
    if (!Array.isArray(draft.lines) || !draft.lines.length) throw new Error("Add at least one expense line.");
    const lines: Array<{ categoryId: string; taxCodeId: string; description: string; amount: number }> = draft.lines.map((line: any, index: number) => {
      const categoryId = String(line.categoryId ?? "").trim();
      const taxCodeId = String(line.taxCodeId ?? "").trim();
      if (!categoryId || !taxCodeId) throw new Error(`Choose a Category and GST for expense line ${index + 1}.`);
      return { categoryId, taxCodeId, description: String(line.description ?? "").trim(), amount: lineInput(line.amount, `Expense line ${index + 1} amount`) };
    });
    const total = lines.reduce((sum: number, line: { amount: number }) => sum + line.amount, 0);
    const currentResult = await qboRequest(`/bill/${voucher.quickbooks_bill_id}`, { method: "GET" });
    const current = currentResult?.Bill;
    if (!current?.Id || current.SyncToken == null) throw new Error("QuickBooks Bill is missing its update token.");
    const taxCodes = new Map((await listQuickBooksTaxCodes()).map((code) => [code.id, code]));
    const taxRates = new Map<string, { rate: number; taxableAmount: number }>();
    lines.forEach((line: { categoryId: string; taxCodeId: string; description: string; amount: number }) => {
      const code = taxCodes.get(line.taxCodeId);
      if (!code) throw new Error("Choose a valid GST code for every expense line.");
      code.purchaseTaxRates.forEach((taxRate: { id: string; rate: number }) => {
        const existing = taxRates.get(taxRate.id) ?? { rate: taxRate.rate, taxableAmount: 0 };
        existing.taxableAmount += line.amount;
        taxRates.set(taxRate.id, existing);
      });
    });
    const allOutOfScope = lines.every((line) => {
      const code = taxCodes.get(line.taxCodeId);
      return Boolean(code && code.rate === 0 && /out\s*of\s*scope/i.test(code.name));
    });
    const rawOverall = String(draft.overallGstAmount ?? "").trim();
    const overall = allOutOfScope || rawOverall === "" ? null : Number(rawOverall);
    if (overall !== null && (!Number.isFinite(overall) || overall < 0)) throw new Error("Overall GST amount must be zero or greater.");
    const calculated = [...taxRates.values()].reduce((sum, line) => sum + Math.round(line.taxableAmount * line.rate) / 100, 0);
    const delta = overall === null ? 0 : Math.round((overall - calculated) * 100) / 100;
    const taxEntries = [...taxRates.entries()];
    const updated = await qboRequest("/bill", {
      method: "POST",
      body: JSON.stringify({
        Id: current.Id, SyncToken: current.SyncToken, sparse: false,
        VendorRef: { value: supplierId }, TxnDate: String(draft.billDate ?? "").trim() || undefined,
        DueDate: String(draft.dueDate ?? "").trim() || undefined, DocNumber: billNumber,
        ...(String(draft.termId ?? "").trim() ? { SalesTermRef: { value: String(draft.termId).trim() } } : {}),
        ...(String(draft.mailingAddress ?? "").trim() ? { VendorAddr: { Line1: String(draft.mailingAddress).trim() } } : {}),
        PrivateNote: memo, GlobalTaxCalculation: "TaxExcluded",
        ...(overall !== null ? { TxnTaxDetail: { TotalTax: overall, TaxLine: taxEntries.map(([id, tax], index) => ({
          Amount: Math.round((Math.round(tax.taxableAmount * tax.rate) / 100 + (index === taxEntries.length - 1 ? delta : 0)) * 100) / 100,
          DetailType: "TaxLineDetail", TaxLineDetail: { TaxRateRef: { value: id }, PercentBased: true, TaxPercent: tax.rate, NetAmountTaxable: tax.taxableAmount, ...(index === taxEntries.length - 1 && delta !== 0 ? { OverrideDeltaAmount: delta } : {}) },
        })) } } : {}),
        Line: lines.map((line: { categoryId: string; taxCodeId: string; description: string; amount: number }, index: number) => ({ LineNum: index + 1, Amount: line.amount, Description: line.description, DetailType: "AccountBasedExpenseLineDetail", AccountBasedExpenseLineDetail: { AccountRef: { value: line.categoryId }, TaxCodeRef: { value: line.taxCodeId } } })),
      }),
    });
    const attachments = formData.getAll("attachments").filter((file): file is File => file instanceof File && file.size > 0);
    const uploaded = [...(voucher.quickbooks_attachment_files ?? [])];
    for (const [index, attachment] of attachments.entries()) {
      const upload = await qboUploadAttachment(attachment, { id: String(current.Id), type: "Bill" });
      const attachable = upload?.AttachableResponse?.[0]?.Attachable;
      uploaded.push({
        name: attachment.name,
        ...(attachable?.Id ? { id: String(attachable.Id) } : {}),
        contentType: attachment.type || "application/octet-stream",
        ...(draft.attachmentFiles?.[index]?.url ? { url: draft.attachmentFiles[index].url } : {}),
        ...(draft.attachmentFiles?.[index]?.storagePath ? { storagePath: draft.attachmentFiles[index].storagePath } : {}),
      });
    }
    const { data: row, error } = await supabaseAdmin.from("additional_costs").update({
      cost: total, quickbooks_invoice_number: String(updated?.Bill?.DocNumber ?? billNumber), quickbooks_supplier_id: supplierId,
      quickbooks_supplier_name: String(draft.supplierName ?? updated?.Bill?.VendorRef?.name ?? ""), quickbooks_attachment_files: uploaded,
      quickbooks_overall_gst_override: overall,
      quickbooks_bill_sync_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", voucher.id).select("*").single();
    if (error) throw error;
    const { error: subitemError } = await supabaseAdmin.from("subitems").update({ cost: String(total) })
      .eq("custom_fields->>additionalCostId", voucher.id).is("deleted_at", null);
    if (subitemError) throw subitemError;
    return NextResponse.json({ row });
  } catch (error) { return fail(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json() as { voucherId?: string };
    const { voucher } = await authorisedVoucher(String(body.voucherId ?? ""));
    const { data: row, error } = await supabaseAdmin.from("additional_costs").update({
      has_quickbooks_bill: false,
      quickbooks_bill_id: null,
      quickbooks_invoice_number: "",
      quickbooks_supplier_id: "",
      quickbooks_supplier_name: "",
      quickbooks_overall_gst_override: null,
      quickbooks_attachment_files: [],
      quickbooks_bill_sync_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", voucher.id).select("*").single();
    if (error) throw error;
    return NextResponse.json({ row });
  } catch (error) { return fail(error); }
}

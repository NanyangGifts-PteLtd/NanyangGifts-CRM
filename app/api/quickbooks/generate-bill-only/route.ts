import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { qboRequest, qboUploadAttachment } from "@/lib/quickbooks/api";
import { ensureQuickBooksBillNumberAvailable } from "@/lib/quickbooks/bill-duplicate-check";
import { listQuickBooksTaxCodes } from "@/lib/quickbooks/bill-options";

const ALLOWED_ROLES = new Set(["admin", "director", "dev"]);

async function nextReference() {
  const { data, error } = await supabaseAdmin.rpc("next_payment_voucher_reference_id");
  if (error || data === null) throw error ?? new Error("Could not allocate a Payment Voucher Reference ID.");
  return String(data);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!ALLOWED_ROLES.has(String(profile?.role ?? "").toLowerCase())) throw new Error("Unauthorized");

    const formData = await request.formData();
    const raw = formData.get("payload");
    if (typeof raw !== "string") throw new Error("Bill details are required.");
    const { bill, voucherId } = JSON.parse(raw) as { voucherId?: string; bill?: {
      supplierId?: string; supplierName?: string; mailingAddress?: string; termId?: string;
      billDate?: string; dueDate?: string; billNumber?: string; memo?: string;
      overallGstAmount?: string;
      attachmentFiles?: Array<{ name?: string; url?: string; storagePath?: string }>;
      lines?: Array<{ categoryId?: string; description?: string; amount?: string; taxCodeId?: string }>;
    } };
    if (!bill) throw new Error("Bill details are required.");
    let supplierId = String(bill.supplierId ?? "").trim();
    const supplierName = String(bill.supplierName ?? "").trim();
    const billNumber = String(bill.billNumber ?? "").trim();
    const memo = String(bill.memo ?? "").trim();
    const overallGstText = String(bill.overallGstAmount ?? "").trim();
    const overallGstAmount = overallGstText === "" ? null : Number(overallGstText);
    if (!supplierId && !supplierName) throw new Error("Supplier is required.");
    if (!billNumber) throw new Error("Invoice no. is required.");
    if (!memo) throw new Error("Memo is required.");
    if (overallGstAmount !== null && (!Number.isFinite(overallGstAmount) || overallGstAmount < 0))
      throw new Error("Overall GST amount must be zero or greater.");
    if (!supplierId) {
      const created = await qboRequest("/vendor", { method: "POST", body: JSON.stringify({ DisplayName: supplierName, CompanyName: supplierName }) });
      supplierId = String(created?.Vendor?.Id ?? "");
      if (!supplierId) throw new Error("QuickBooks could not create the new Supplier.");
    }
    await ensureQuickBooksBillNumberAvailable({ supplierId, billNumber });
    const lines = bill.lines ?? [];
    if (!lines.length) throw new Error("Add at least one expense line.");
    const normalisedLines = lines.map((line, index) => {
      const categoryId = String(line.categoryId ?? "").trim();
      const taxCodeId = String(line.taxCodeId ?? "").trim();
      const amount = Number(line.amount);
      if (!categoryId || !taxCodeId || !Number.isFinite(amount) || amount <= 0) throw new Error(`Complete Category, Amount and GST for expense line ${index + 1}.`);
      return { categoryId, taxCodeId, amount, description: String(line.description ?? "") };
    });
    const taxCodes = new Map((await listQuickBooksTaxCodes()).map((taxCode) => [taxCode.id, taxCode]));
    const allLinesOutOfScope = normalisedLines.every((line) => {
      const taxCode = taxCodes.get(line.taxCodeId);
      return Boolean(taxCode && taxCode.rate === 0 && /out\s*of\s*scope/i.test(taxCode.name));
    });
    const effectiveOverallGstAmount = allLinesOutOfScope ? null : overallGstAmount;
    const taxLinesByRate = new Map<string, { rate: number; taxableAmount: number }>();
    normalisedLines.forEach((line) => {
      const taxCode = taxCodes.get(line.taxCodeId);
      if (!taxCode) throw new Error("Choose a valid GST code for every expense line.");
      taxCode.purchaseTaxRates.forEach((taxRate: { id: string; rate: number }) => {
        const existing = taxLinesByRate.get(taxRate.id) ?? { rate: taxRate.rate, taxableAmount: 0 };
        existing.taxableAmount += line.amount;
        taxLinesByRate.set(taxRate.id, existing);
      });
    });
    const calculatedTaxTotal = [...taxLinesByRate.values()].reduce(
      (total, taxLine) => total + Math.round(taxLine.taxableAmount * taxLine.rate) / 100,
      0,
    );
    const overrideDelta = effectiveOverallGstAmount === null
      ? 0
      : Math.round((effectiveOverallGstAmount - calculatedTaxTotal) * 100) / 100;
    const taxRateEntries = [...taxLinesByRate.entries()];
    const created = await qboRequest("/bill", {
      method: "POST",
      body: JSON.stringify({
        VendorRef: { value: supplierId }, TxnDate: bill.billDate || undefined, DueDate: bill.dueDate || undefined,
        DocNumber: billNumber, PrivateNote: memo, GlobalTaxCalculation: "TaxExcluded",
        ...(bill.termId ? { SalesTermRef: { value: bill.termId } } : {}),
        ...(bill.mailingAddress ? { VendorAddr: { Line1: bill.mailingAddress } } : {}),
        ...(effectiveOverallGstAmount !== null ? {
          TxnTaxDetail: {
            TotalTax: effectiveOverallGstAmount,
            TaxLine: taxRateEntries.map(([taxRateId, taxLine], index) => {
              const calculatedAmount = Math.round(taxLine.taxableAmount * taxLine.rate) / 100;
              const receivesDelta = index === taxRateEntries.length - 1;
              return {
                Amount: Math.round((calculatedAmount + (receivesDelta ? overrideDelta : 0)) * 100) / 100,
                DetailType: "TaxLineDetail",
                TaxLineDetail: {
                  TaxRateRef: { value: taxRateId }, PercentBased: true,
                  TaxPercent: taxLine.rate, NetAmountTaxable: taxLine.taxableAmount,
                  ...(receivesDelta && overrideDelta !== 0 ? { OverrideDeltaAmount: overrideDelta } : {}),
                },
              };
            }),
          },
        } : {}),
        Line: normalisedLines.map((line, index) => ({ LineNum: index + 1, Amount: line.amount, Description: line.description, DetailType: "AccountBasedExpenseLineDetail", AccountBasedExpenseLineDetail: { AccountRef: { value: line.categoryId }, TaxCodeRef: { value: line.taxCodeId } } })),
      }),
    });
    const quickBooksBill = created?.Bill;
    if (!quickBooksBill?.Id) throw new Error("QuickBooks did not return a Bill ID.");
    const attachments = formData.getAll("attachments").filter((entry): entry is File => entry instanceof File);
    const savedAttachments: Array<{ name: string; id?: string; contentType: string; url?: string; storagePath?: string }> = [];
    const attachmentErrors: string[] = [];
    for (const [index, attachment] of attachments.entries()) {
      try {
        const uploaded = await qboUploadAttachment(attachment, { id: String(quickBooksBill.Id), type: "Bill" });
        const attachable = uploaded?.AttachableResponse?.[0]?.Attachable;
        savedAttachments.push({ name: attachment.name, contentType: attachment.type || "application/octet-stream", ...(attachable?.Id ? { id: String(attachable.Id) } : {}), ...(bill.attachmentFiles?.[index]?.url ? { url: bill.attachmentFiles[index].url } : {}), ...(bill.attachmentFiles?.[index]?.storagePath ? { storagePath: bill.attachmentFiles[index].storagePath } : {}) });
      } catch (attachmentError) {
        attachmentErrors.push(`${attachment.name}: ${attachmentError instanceof Error ? attachmentError.message : "upload failed"}`);
      }
    }
    const total = normalisedLines.reduce((sum, line) => sum + line.amount, 0);
    const billFields = {
      cost: total, has_quickbooks_bill: true, quickbooks_bill_sync_error: null,
      quickbooks_bill_id: String(quickBooksBill.Id), quickbooks_invoice_number: String(quickBooksBill.DocNumber ?? billNumber),
      quickbooks_supplier_id: supplierId, quickbooks_supplier_name: String(quickBooksBill.VendorRef?.name ?? supplierName),
      quickbooks_overall_gst_override: effectiveOverallGstAmount,
      quickbooks_attachment_files: savedAttachments,
    };
    let row: unknown;
    let error: { message: string } | null = null;
    if (voucherId) {
      const result = await supabase.from("additional_costs").update(billFields)
        .eq("id", voucherId).eq("voucher_group", "quickbooks_bills_only").is("deleted_at", null).select("*").single();
      row = result.data; error = result.error;
    } else {
      const result = await supabase.rpc("create_quickbooks_bills_only_voucher", {
        p_cost: total,
        p_reference_id: await nextReference(),
        p_quickbooks_bill_id: String(quickBooksBill.Id),
        p_invoice_number: String(quickBooksBill.DocNumber ?? billNumber),
        p_supplier_id: supplierId,
        p_supplier_name: String(quickBooksBill.VendorRef?.name ?? supplierName),
        p_attachment_files: savedAttachments,
      });
      row = result.data; error = result.error;
    }
    if (error) throw error;
    if (!voucherId && effectiveOverallGstAmount !== null && row && typeof row === "object" && "id" in row) {
      const rowId = String((row as { id?: unknown }).id ?? "");
      if (rowId) {
        const updated = await supabaseAdmin.from("additional_costs")
          .update({ quickbooks_overall_gst_override: effectiveOverallGstAmount })
          .eq("id", rowId)
          .select("*")
          .single();
        if (updated.error) throw updated.error;
        row = updated.data;
      }
    }
    return NextResponse.json({ row, docNumber: quickBooksBill.DocNumber ?? billNumber, attachmentErrors }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate QuickBooks Bill.";
    return NextResponse.json({ error: message }, { status: /unauthorized/i.test(message) ? 401 : 400 });
  }
}

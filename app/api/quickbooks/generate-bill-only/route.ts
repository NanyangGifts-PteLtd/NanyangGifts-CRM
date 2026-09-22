import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { qboRequest, qboUploadAttachment } from "@/lib/quickbooks/api";
import { ensureQuickBooksBillNumberAvailable } from "@/lib/quickbooks/bill-duplicate-check";

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
      attachmentFiles?: Array<{ name?: string; url?: string; storagePath?: string }>;
      lines?: Array<{ categoryId?: string; description?: string; amount?: string; taxCodeId?: string }>;
    } };
    if (!bill) throw new Error("Bill details are required.");
    let supplierId = String(bill.supplierId ?? "").trim();
    const supplierName = String(bill.supplierName ?? "").trim();
    const billNumber = String(bill.billNumber ?? "").trim();
    const memo = String(bill.memo ?? "").trim();
    if (!supplierId && !supplierName) throw new Error("Supplier is required.");
    if (!billNumber) throw new Error("Invoice no. is required.");
    if (!memo) throw new Error("Memo is required.");
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
    const created = await qboRequest("/bill", {
      method: "POST",
      body: JSON.stringify({
        VendorRef: { value: supplierId }, TxnDate: bill.billDate || undefined, DueDate: bill.dueDate || undefined,
        DocNumber: billNumber, PrivateNote: memo, GlobalTaxCalculation: "TaxExcluded",
        ...(bill.termId ? { SalesTermRef: { value: bill.termId } } : {}),
        ...(bill.mailingAddress ? { VendorAddr: { Line1: bill.mailingAddress } } : {}),
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
      quickbooks_attachment_files: savedAttachments,
    };
    let row: unknown;
    let error: { message: string } | null = null;
    if (voucherId) {
      const result = await supabaseAdmin.from("additional_costs").update(billFields)
        .eq("id", voucherId).eq("voucher_group", "quickbooks_bills_only").is("deleted_at", null).select("*").single();
      row = result.data; error = result.error;
    } else {
      const result = await supabaseAdmin.from("additional_costs").insert({
        client_id: null, voucher_group: "quickbooks_bills_only", position: 0, created_by: user.id,
        reason: "", items_sent: "", courier: "", remarks: "", trip_id: await nextReference(), ...billFields,
      }).select("*").single();
      row = result.data; error = result.error;
    }
    if (error) throw error;
    return NextResponse.json({ row, docNumber: quickBooksBill.DocNumber ?? billNumber, attachmentErrors }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate QuickBooks Bill.";
    return NextResponse.json({ error: message }, { status: /unauthorized/i.test(message) ? 401 : 400 });
  }
}

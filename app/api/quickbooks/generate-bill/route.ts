import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { qboRequest, qboUploadAttachment } from "@/lib/quickbooks/api";
import { listQuickBooksTaxCodes } from "@/lib/quickbooks/bill-options";
import { ensureQuickBooksBillNumberAvailable } from "@/lib/quickbooks/bill-duplicate-check";
import { getSystemLabel } from "@/lib/system-labels";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);

async function nextPaymentVoucherReference() {
  const { data, error } = await supabaseAdmin.rpc(
    "next_payment_voucher_reference_id",
  );
  if (error || data === null) throw error ?? new Error("Could not allocate a Payment Voucher Reference ID.");
  return String(data);
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not generate QuickBooks Bill.";
  return NextResponse.json({ error: message }, { status: /unauthorized/i.test(message) ? 401 : 400 });
}

async function resolveLabel(code: string, value: unknown) {
  const text = String(value ?? "").trim();
  const { data: group, error: groupError } = await supabaseAdmin
    .from("option_groups")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (groupError || !group) throw new Error(`The ${code.replaceAll("_", " ")} labels are unavailable.`);
  const { data: option, error } = await supabaseAdmin
    .from("option_values")
    .select("id, value, system_key")
    .eq("group_id", group.id)
    .eq("value", text)
    .maybeSingle();
  if (error || !option) throw new Error(`Choose a valid ${code.replace("additional_cost_", "")} label.`);
  return { ...option, systemKey: (option as { system_key?: string | null }).system_key ?? null };
}

function money(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} must be greater than zero.`);
  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = String(profile?.role ?? "").toLowerCase();
    if (!INTERNAL_ROLES.has(role)) throw new Error("Unauthorized");

    const formData = await request.formData();
    const payload = formData.get("payload");
    if (typeof payload !== "string") throw new Error("Bill details are required.");
    const body = JSON.parse(payload) as {
      clientId?: string;
      voucherId?: string;
      voucher?: { cost?: unknown; reason?: unknown; remarks?: unknown; relatedSubitemIds?: unknown };
      bill?: {
        supplierId?: unknown; mailingAddress?: unknown; termId?: unknown; billDate?: unknown;
        dueDate?: unknown; billNumber?: unknown; supplierName?: unknown; memo?: unknown;
        overallGstAmount?: unknown;
        lines?: Array<{ categoryId?: unknown; description?: unknown; amount?: unknown; taxCodeId?: unknown }>;
      };
    };
    const attachments = formData.getAll("attachments").filter(
      (entry): entry is File =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as File).arrayBuffer === "function" &&
        typeof (entry as File).name === "string",
    );
    if (attachments.some((file) => file.size > 20 * 1024 * 1024))
      throw new Error("Each attachment must be 20 MB or smaller.");
    if (!body.clientId) throw new Error("Choose a client before generating a Bill.");
    const bill = body.bill;
    const voucher = body.voucher;
    const existingVoucherId = String(body.voucherId ?? "").trim();
    if (!bill || (!voucher && !existingVoucherId)) throw new Error("Bill and payment voucher details are required.");
    let supplierId = String(bill.supplierId ?? "").trim();
    const supplierName = String(bill.supplierName ?? "").trim();
    const invoiceNumber = String(bill.billNumber ?? "").trim();
    const memo = String(bill.memo ?? "").trim();
    const overallGstText = String(bill.overallGstAmount ?? "").trim();
    const overallGstAmount = overallGstText === "" ? null : Number(overallGstText);
    if (!supplierId && !supplierName) throw new Error("Supplier is required.");
    if (!supplierId) {
      const createdVendor = await qboRequest("/vendor", {
        method: "POST",
        body: JSON.stringify({ DisplayName: supplierName, CompanyName: supplierName }),
      });
      supplierId = String(createdVendor?.Vendor?.Id ?? "");
      if (!supplierId) throw new Error("QuickBooks could not create the new Supplier.");
    }
    if (!invoiceNumber) throw new Error("Invoice no. is required.");
    if (!memo) throw new Error("Memo is required.");
    await ensureQuickBooksBillNumberAvailable({ supplierId, billNumber: invoiceNumber });
    if (overallGstAmount !== null && (!Number.isFinite(overallGstAmount) || overallGstAmount < 0))
      throw new Error("Overall GST amount must be zero or greater.");
    if (!Array.isArray(bill.lines) || !bill.lines.length) throw new Error("Add at least one expense line.");
    const lines = bill.lines.map((line, index) => {
      const categoryId = String(line.categoryId ?? "").trim();
      const description = String(line.description ?? "").trim();
      const taxCodeId = String(line.taxCodeId ?? "").trim();
      if (!categoryId || !taxCodeId) throw new Error(`Choose a Category and GST for expense line ${index + 1}.`);
      return { categoryId, description, taxCodeId, amount: money(line.amount, `Expense line ${index + 1} amount`) };
    });
    const cost = voucher ? money(voucher.cost, "Cost") : null;
    const expenseTotal = lines.reduce((total, line) => total + line.amount, 0);
    if (cost !== null && Math.abs(cost - expenseTotal) > 0.005) throw new Error("Payment Voucher Cost must equal the expense-line total.");

    const relatedSubitemIds = Array.isArray(voucher?.relatedSubitemIds)
      ? [...new Set(voucher.relatedSubitemIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))]
      : [];
    if (!existingVoucherId && !relatedSubitemIds.length) throw new Error("Select at least one Related Subitem.");
    const reason = voucher ? await resolveLabel("additional_cost_reason", voucher.reason) : null;
    const remarks = String(voucher?.remarks ?? "").trim();
    const otherReason = await getSystemLabel("additional_cost_reason", "additional_cost_reason_other");
    if (reason?.id === otherReason.id && !remarks)
      throw new Error("Remarks is required when Reason is Other.");

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, custom_fields")
      .eq("id", body.clientId)
      .is("deleted_at", null)
      .maybeSingle();
    if (clientError || !client) throw new Error("The selected client is no longer available.");
    if (client.custom_fields?.subitemsLocked === "true") throw new Error("This client is locked.");
    if (!['admin', 'director'].includes(role)) {
      const { data: assignment, error } = await supabaseAdmin.from("client_assignees")
        .select("client_id").eq("client_id", client.id).eq("user_id", user.id)
        .in("assignment_type", ["people", "pm"]).maybeSingle();
      if (error) throw error;
      if (!assignment) throw new Error("You can only create payment vouchers for clients assigned to you.");
    }
    let existingVoucher: { id: string; client_id: string; courier_option_id: string | null; reason: string; has_quickbooks_bill: boolean | null } | null = null;
    if (existingVoucherId) {
      const { data, error } = await supabaseAdmin.from("additional_costs")
        .select("id, client_id, courier_option_id, reason, has_quickbooks_bill")
        .eq("id", existingVoucherId).is("deleted_at", null).maybeSingle();
      if (error || !data || data.client_id !== client.id) throw new Error("The payment voucher is no longer available.");
      const [lalamoveCourier, easyparcelCourier] = await Promise.all([
        getSystemLabel("additional_cost_courier", "additional_cost_courier_lalamove"),
        getSystemLabel("additional_cost_courier", "additional_cost_courier_easyparcel"),
      ]);
      if (
        data.has_quickbooks_bill ||
        [lalamoveCourier.id, easyparcelCourier.id].includes(
          String(data.courier_option_id ?? ""),
        )
      )
        throw new Error("This payment voucher already has a QuickBooks Bill or is not in the Bill group.");
      existingVoucher = data;
    }
    const { data: relatedSubitems, error: relatedError } = await supabaseAdmin
      .from("subitems").select("id, name, custom_fields")
      .eq("client_id", client.id).is("deleted_at", null).in("id", relatedSubitemIds);
    if (relatedError) throw relatedError;
    if (!existingVoucherId && ((relatedSubitems ?? []).length !== relatedSubitemIds.length || (relatedSubitems ?? []).some((item) => item.custom_fields?.additionalCostId)))
      throw new Error("One or more selected Related Subitems are unavailable.");
    const names = new Map((relatedSubitems ?? []).map((item) => [item.id, item.name]));
    const relatedNames = relatedSubitemIds.map((id) => names.get(id) ?? "").filter(Boolean).join(", ");
    const taxCodeById = new Map(
      (await listQuickBooksTaxCodes()).map((taxCode) => [taxCode.id, taxCode]),
    );
    const allLinesOutOfScope = lines.every((line) => {
      const taxCode = taxCodeById.get(line.taxCodeId);
      return Boolean(taxCode && taxCode.rate === 0 && /out\s*of\s*scope/i.test(taxCode.name));
    });
    const effectiveOverallGstAmount = allLinesOutOfScope ? null : overallGstAmount;
    const taxableLineIndexes = lines.flatMap((line, index) => {
      const taxCode = taxCodeById.get(line.taxCodeId);
      if (!taxCode) throw new Error("Choose a valid GST code for every expense line.");
      return taxCode.rate > 0 ? [index] : [];
    });
    if (effectiveOverallGstAmount !== null && effectiveOverallGstAmount > 0 && !taxableLineIndexes.length)
      throw new Error("An Overall GST amount requires at least one taxable expense line.");

    const billLines = lines.map((line, index) => {
      const taxCode = taxCodeById.get(line.taxCodeId);
      if (!taxCode) throw new Error("Choose a valid GST code for every expense line.");
      return {
        ...line,
        taxCode,
      };
    });
    const taxLinesByRate = new Map<string, { rate: number; taxableAmount: number }>();
    billLines.forEach((line) => {
      line.taxCode.purchaseTaxRates.forEach((taxRate: { id: string; rate: number }) => {
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

    const billResult = await qboRequest("/bill", {
      method: "POST",
      body: JSON.stringify({
        VendorRef: { value: supplierId },
        TxnDate: String(bill.billDate ?? "").trim() || undefined,
        DueDate: String(bill.dueDate ?? "").trim() || undefined,
        DocNumber: invoiceNumber,
        ...(String(bill.termId ?? "").trim() ? { SalesTermRef: { value: String(bill.termId).trim() } } : {}),
        ...(String(bill.mailingAddress ?? "").trim() ? { VendorAddr: { Line1: String(bill.mailingAddress).trim() } } : {}),
        PrivateNote: memo,
        GlobalTaxCalculation: "TaxExcluded",
        ...(effectiveOverallGstAmount !== null ? {
          // QBO applies a manual GST change only when it is represented as an
          // override on a TaxLineDetail; TotalTax by itself is recalculated.
          TxnTaxDetail: {
            TotalTax: effectiveOverallGstAmount,
            TaxLine: taxRateEntries.map(([taxRateId, taxLine], index) => {
              const receivesDelta = index === taxRateEntries.length - 1;
              const calculatedAmount = Math.round(taxLine.taxableAmount * taxLine.rate) / 100;
              const amount = Math.round((calculatedAmount + (receivesDelta ? overrideDelta : 0)) * 100) / 100;
              return {
                Amount: amount,
                DetailType: "TaxLineDetail",
                TaxLineDetail: {
                  TaxRateRef: { value: taxRateId },
                  PercentBased: true,
                  TaxPercent: taxLine.rate,
                  NetAmountTaxable: taxLine.taxableAmount,
                  ...(receivesDelta && overrideDelta !== 0 ? { OverrideDeltaAmount: overrideDelta } : {}),
                },
              };
            }),
          },
        } : {}),
        Line: billLines.map((line, index) => ({
          LineNum: index + 1,
          Amount: line.amount,
          Description: line.description,
          DetailType: "AccountBasedExpenseLineDetail",
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: line.categoryId },
            TaxCodeRef: { value: line.taxCodeId },
          },
        })),
      }),
    });
    const quickBooksBill = billResult?.Bill;
    if (!quickBooksBill?.Id) throw new Error("QuickBooks did not return a Bill ID.");
    const shippingUpsReason = await getSystemLabel("additional_cost_reason", "additional_cost_reason_shipping_ups");
    const isUpsLinkedSubitem = reason?.id === shippingUpsReason.id ||
      /\bups\b/i.test(String(bill.supplierName ?? quickBooksBill.VendorRef?.name ?? ""));
    const linkedSubitemStatus = await getSystemLabel(
      "subitem_status",
      isUpsLinkedSubitem
        ? "subitem_status_awarded"
        : "subitem_status_variation_cost_difference",
    );
    const attachmentErrors: string[] = [];
    const uploadedAttachments: Array<{ name: string; id?: string; contentType: string }> = [];
    for (const attachment of attachments) {
      try {
        const uploadResult = await qboUploadAttachment(attachment, {
          id: String(quickBooksBill.Id),
          type: "Bill",
        });
        const attachable = uploadResult?.AttachableResponse?.[0]?.Attachable;
        uploadedAttachments.push({
          name: attachment.name,
          ...(attachable?.Id ? { id: String(attachable.Id) } : {}),
          contentType: attachment.type || "application/octet-stream",
        });
      } catch (uploadError) {
        attachmentErrors.push(
          `${attachment.name}: ${uploadError instanceof Error ? uploadError.message : "upload failed"}`,
        );
      }
    }

    if (existingVoucher) {
      const { data: updatedVoucher, error: updateError } = await supabaseAdmin
        .from("additional_costs")
        .update({
          cost: expenseTotal,
          has_quickbooks_bill: true,
          quickbooks_bill_sync_error: null,
          quickbooks_invoice_number: String(quickBooksBill.DocNumber ?? invoiceNumber),
          quickbooks_supplier_id: supplierId,
          quickbooks_supplier_name: String(bill.supplierName ?? quickBooksBill.VendorRef?.name ?? ""),
          quickbooks_bill_id: String(quickBooksBill.Id),
          quickbooks_attachment_files: uploadedAttachments,
        })
        .eq("id", existingVoucher.id)
        .select("*")
        .single();
      if (updateError) throw updateError;
      const { error: linkedSubitemError } = await supabaseAdmin
        .from("subitems")
        .update({
          cost: String(expenseTotal),
          ...(isUpsLinkedSubitem ? {
            status: linkedSubitemStatus.value,
            status_option_id: linkedSubitemStatus.id,
          } : {}),
        })
        .eq("custom_fields->>additionalCostId", existingVoucher.id)
        .is("deleted_at", null);
      if (linkedSubitemError) throw linkedSubitemError;
      return NextResponse.json({ row: updatedVoucher, billId: quickBooksBill.Id, docNumber: quickBooksBill.DocNumber ?? invoiceNumber, attachmentErrors });
    }

    if (!voucher || !reason || cost === null) throw new Error("Payment voucher details are required.");
    const createdAt = new Date().toISOString();
    const { data: latest } = await supabaseAdmin.from("additional_costs").select("position").eq("client_id", client.id).order("position", { ascending: false }).limit(1).maybeSingle();
    const nextReference = await nextPaymentVoucherReference();
    const { data: voucherRow, error: voucherError } = await supabaseAdmin.from("additional_costs").insert({
      client_id: client.id, position: Number(latest?.position ?? -1) + 1, created_by: user.id, created_at: createdAt,
      cost, reason: reason.value, reason_option_id: reason.id, items_sent: relatedNames,
      courier: "", courier_option_id: null, remarks, trip_id: nextReference,
      has_quickbooks_bill: true,
      quickbooks_bill_sync_error: null,
      quickbooks_invoice_number: String(quickBooksBill.DocNumber ?? invoiceNumber),
      quickbooks_supplier_id: supplierId,
      quickbooks_supplier_name: String(bill.supplierName ?? quickBooksBill.VendorRef?.name ?? ""),
      quickbooks_bill_id: String(quickBooksBill.Id),
      quickbooks_attachment_files: uploadedAttachments,
    }).select("*").single();
    if (voucherError) throw voucherError;
    try {
      const { data: lastSubitem } = await supabaseAdmin.from("subitems").select("position").eq("client_id", client.id).order("position", { ascending: false }).limit(1).maybeSingle();
      const { data: subitem, error: subitemError } = await supabaseAdmin.from("subitems").insert({
        client_id: client.id, position: Number(lastSubitem?.position ?? -1) + 1, created_at: createdAt,
        name: reason.value, status: linkedSubitemStatus.value, status_option_id: linkedSubitemStatus.id, qty: "1", currency: "SGD", cost: String(cost),
        custom_fields: { additionalCostId: voucherRow.id, additionalCostLinked: "true", quickBooksBillId: String(quickBooksBill.Id) },
      }).select("id").single();
      if (subitemError) throw subitemError;
      const { error: assigneeError } = await supabaseAdmin.from("subitem_assignees").insert({ subitem_id: subitem.id, user_id: user.id, assigned_by: user.id });
      if (assigneeError) throw assigneeError;
    } catch (databaseError) {
      await supabaseAdmin.from("additional_costs").delete().eq("id", voucherRow.id);
      throw databaseError;
    }
    return NextResponse.json({ row: voucherRow, billId: quickBooksBill.Id, docNumber: quickBooksBill.DocNumber ?? invoiceNumber, attachmentErrors }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { qboRequest, qboUploadAttachment } from "@/lib/quickbooks/api";
import { listQuickBooksTaxCodes } from "@/lib/quickbooks/bill-options";

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
    .select("id, value")
    .eq("group_id", group.id)
    .eq("value", text)
    .maybeSingle();
  if (error || !option) throw new Error(`Choose a valid ${code.replace("additional_cost_", "")} label.`);
  return option;
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
      voucher?: { cost?: unknown; reason?: unknown; remarks?: unknown; relatedSubitemIds?: unknown };
      bill?: {
        supplierId?: unknown; mailingAddress?: unknown; termId?: unknown; billDate?: unknown;
        dueDate?: unknown; billNumber?: unknown; supplierName?: unknown; memo?: unknown;
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
    if (!bill || !voucher) throw new Error("Bill and payment voucher details are required.");
    const supplierId = String(bill.supplierId ?? "").trim();
    const invoiceNumber = String(bill.billNumber ?? "").trim();
    const memo = String(bill.memo ?? "").trim();
    if (!supplierId) throw new Error("Supplier is required.");
    if (!invoiceNumber) throw new Error("Invoice no. is required.");
    if (!memo) throw new Error("Memo is required.");
    if (!Array.isArray(bill.lines) || !bill.lines.length) throw new Error("Add at least one expense line.");
    const lines = bill.lines.map((line, index) => {
      const categoryId = String(line.categoryId ?? "").trim();
      const description = String(line.description ?? "").trim();
      const taxCodeId = String(line.taxCodeId ?? "").trim();
      if (!categoryId || !taxCodeId) throw new Error(`Choose a Category and GST for expense line ${index + 1}.`);
      return { categoryId, description, taxCodeId, amount: money(line.amount, `Expense line ${index + 1} amount`) };
    });
    const cost = money(voucher.cost, "Cost");
    const expenseTotal = lines.reduce((total, line) => total + line.amount, 0);
    if (Math.abs(cost - expenseTotal) > 0.005) throw new Error("Payment Voucher Cost must equal the expense-line total.");

    const relatedSubitemIds = Array.isArray(voucher.relatedSubitemIds)
      ? [...new Set(voucher.relatedSubitemIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))]
      : [];
    if (!relatedSubitemIds.length) throw new Error("Select at least one Related Subitem.");
    const reason = await resolveLabel("additional_cost_reason", voucher.reason);
    const remarks = String(voucher.remarks ?? "").trim();
    if (reason.value.trim().toLowerCase() === "other" && !remarks)
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
    const { data: relatedSubitems, error: relatedError } = await supabaseAdmin
      .from("subitems").select("id, name, custom_fields")
      .eq("client_id", client.id).is("deleted_at", null).in("id", relatedSubitemIds);
    if (relatedError) throw relatedError;
    if ((relatedSubitems ?? []).length !== relatedSubitemIds.length || (relatedSubitems ?? []).some((item) => item.custom_fields?.additionalCostId))
      throw new Error("One or more selected Related Subitems are unavailable.");
    const names = new Map((relatedSubitems ?? []).map((item) => [item.id, item.name]));
    const relatedNames = relatedSubitemIds.map((id) => names.get(id) ?? "").filter(Boolean).join(", ");
    const taxCodeById = new Map(
      (await listQuickBooksTaxCodes()).map((taxCode) => [taxCode.id, taxCode]),
    );
    const billLines = lines.map((line) => {
      const taxCode = taxCodeById.get(line.taxCodeId);
      if (!taxCode) throw new Error("Choose a valid GST code for every expense line.");
      return {
        ...line,
        // QBO's global tax mode is not enough for mixed GST Bills. Supplying
        // the code and calculated amount on each expense line preserves the
        // selected GST against that individual line.
        taxAmount: Math.round(line.amount * taxCode.rate) / 100,
      };
    });

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
        Line: billLines.map((line, index) => ({
          LineNum: index + 1,
          Amount: line.amount,
          Description: line.description,
          DetailType: "AccountBasedExpenseLineDetail",
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: line.categoryId },
            TaxCodeRef: { value: line.taxCodeId },
            TaxAmount: line.taxAmount,
          },
        })),
      }),
    });
    const quickBooksBill = billResult?.Bill;
    if (!quickBooksBill?.Id) throw new Error("QuickBooks did not return a Bill ID.");
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

    const createdAt = new Date().toISOString();
    const { data: statusGroup, error: statusGroupError } = await supabaseAdmin.from("option_groups").select("id").eq("code", "subitem_status").maybeSingle();
    if (statusGroupError || !statusGroup) throw new Error("Payment Voucher status labels are unavailable.");
    const { data: status, error: statusError } = await supabaseAdmin.from("option_values").select("id, value").eq("group_id", statusGroup.id).eq("value", "[Variation] Cost Difference").maybeSingle();
    if (statusError || !status) throw new Error("[Variation] Cost Difference label is unavailable.");
    const { data: latest } = await supabaseAdmin.from("additional_costs").select("position").eq("client_id", client.id).order("position", { ascending: false }).limit(1).maybeSingle();
    const nextReference = await nextPaymentVoucherReference();
    const { data: voucherRow, error: voucherError } = await supabaseAdmin.from("additional_costs").insert({
      client_id: client.id, position: Number(latest?.position ?? -1) + 1, created_by: user.id, created_at: createdAt,
      cost, reason: reason.value, reason_option_id: reason.id, items_sent: relatedNames,
      courier: "", courier_option_id: null, remarks, trip_id: nextReference,
      has_quickbooks_bill: true,
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
        name: reason.value, status: status.value, status_option_id: status.id, qty: "1", currency: "SGD", cost: String(cost),
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

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { qboQuery, qboRequest } from "@/lib/quickbooks/api";

type QuickBooksInvoice = {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number | string;
  Balance?: number | string;
  TxnTaxDetail?: { TotalTax?: number | string };
  LinkedTxn?: Array<{ TxnId?: string; TxnType?: string }>;
  Line?: Array<{ LinkedTxn?: Array<{ TxnId?: string; TxnType?: string }> }>;
};

function authorized(request: NextRequest) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

const numberOrNull = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function linksToEstimate(invoice: QuickBooksInvoice, estimateId: string) {
  return [...(invoice.LinkedTxn ?? []), ...(invoice.Line ?? []).flatMap((line) => line.LinkedTxn ?? [])]
    .some((link) => link.TxnType?.toLowerCase() === "estimate" && String(link.TxnId) === estimateId);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: clients, error: clientsError } = await supabaseAdmin
    .from("clients")
    .select("id, custom_fields")
    .is("deleted_at", null)
    .not("custom_fields->>trackingEstimateNumber", "is", null);
  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 });

  const candidates = (clients ?? []).filter((client) =>
    typeof client.custom_fields?.trackingEstimateNumber === "string" &&
    client.custom_fields.trackingEstimateNumber.trim().length > 0,
  );
  if (!candidates.length) return NextResponse.json({ ok: true, eligible: 0, synced: 0, failed: 0 });

  const { data: generations, error: generationsError } = await supabaseAdmin
    .from("estimate_generations")
    .select("id, client_id, quickbooks_customer_id, quickbooks_estimate_id, quickbooks_estimate_doc_number, created_at")
    .in("client_id", candidates.map((client) => client.id))
    .not("quickbooks_estimate_id", "is", null)
    .order("created_at", { ascending: false });
  if (generationsError) return NextResponse.json({ error: generationsError.message }, { status: 500 });

  let synced = 0;
  let failed = 0;
  const failures: Array<{ clientId: string; error: string }> = [];

  for (const client of candidates) {
    const selectedQuote = String(client.custom_fields?.trackingEstimateNumber ?? "").trim();
    const generation = (generations ?? []).find((item) =>
      item.client_id === client.id &&
      [item.id, item.quickbooks_estimate_id, item.quickbooks_estimate_doc_number]
        .filter(Boolean)
        .some((value) => String(value) === selectedQuote),
    );
    if (!generation?.quickbooks_estimate_id) continue;

    try {
      const estimateResult = await qboRequest(`/estimate/${generation.quickbooks_estimate_id}`, { method: "GET" });
      const estimate = estimateResult?.Estimate;
      const customerId = estimate?.CustomerRef?.value ?? generation.quickbooks_customer_id;
      if (!customerId) throw new Error("Selected quote has no QuickBooks customer.");
      const escapedCustomerId = String(customerId).replace(/'/g, "\\'");
      const response = await qboQuery(`SELECT * FROM Invoice WHERE CustomerRef = '${escapedCustomerId}'`);
      const invoices = (response?.QueryResponse?.Invoice ?? []) as QuickBooksInvoice[];
      const linked = invoices.filter((invoice) => linksToEstimate(invoice, String(generation.quickbooks_estimate_id)) && invoice.Id);
      const rows = linked.map((invoice) => {
        const total = numberOrNull(invoice.TotalAmt);
        const taxTotal = numberOrNull(invoice.TxnTaxDetail?.TotalTax) ?? 0;
        return {
          estimate_generation_id: generation.id,
          quickbooks_invoice_id: String(invoice.Id),
          quickbooks_invoice_doc_number: invoice.DocNumber ?? null,
          invoice_date: invoice.TxnDate ?? null,
          due_date: invoice.DueDate ?? null,
          subtotal: total === null ? null : total - taxTotal,
          tax_total: numberOrNull(invoice.TxnTaxDetail?.TotalTax),
          total,
          balance: numberOrNull(invoice.Balance),
          raw_payload: invoice,
          last_synced_at: new Date().toISOString(),
        };
      });
      const { data: stored, error: storedError } = await supabaseAdmin
        .from("quickbooks_estimate_invoices")
        .select("quickbooks_invoice_id")
        .eq("estimate_generation_id", generation.id);
      if (storedError) throw storedError;
      const ids = new Set(rows.map((row) => row.quickbooks_invoice_id));
      const staleIds = (stored ?? []).map((row) => row.quickbooks_invoice_id).filter((id) => !ids.has(id));
      if (staleIds.length) {
        const { error } = await supabaseAdmin.from("quickbooks_estimate_invoices")
          .delete().eq("estimate_generation_id", generation.id).in("quickbooks_invoice_id", staleIds);
        if (error) throw error;
      }
      if (rows.length) {
        const { error } = await supabaseAdmin.from("quickbooks_estimate_invoices")
          .upsert(rows, { onConflict: "estimate_generation_id,quickbooks_invoice_id" });
        if (error) throw error;
      }
      const invoiceNumbers = rows.map((row) => row.quickbooks_invoice_doc_number ?? row.quickbooks_invoice_id).filter(Boolean);
      const { error: clientUpdateError } = await supabaseAdmin.from("clients").update({
        custom_fields: {
          ...(client.custom_fields ?? {}),
          trackingInvoiceCreated: rows.length ? "Yes" : "No",
          trackingInvoiceNumber: invoiceNumbers.join(", "),
          trackingMultipleInvoices: rows.length > 1 ? "Yes" : rows.length === 1 ? "No" : "",
        },
      }).eq("id", client.id);
      if (clientUpdateError) throw clientUpdateError;
      synced += 1;
    } catch (error) {
      failed += 1;
      failures.push({ clientId: client.id, error: error instanceof Error ? error.message : "Invoice sync failed" });
    }
  }

  return NextResponse.json({ ok: failed === 0, eligible: candidates.length, synced, failed, failures });
}

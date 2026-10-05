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

  const { data: generations, error: generationsError } = await supabaseAdmin
    .from("estimate_generations")
    .select("id, client_id, quickbooks_customer_id, quickbooks_estimate_id, quickbooks_estimate_doc_number, created_at")
    .not("quickbooks_estimate_id", "is", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (generationsError) return NextResponse.json({ error: generationsError.message }, { status: 500 });

  const activeGenerations = generations ?? [];
  if (!activeGenerations.length)
    return NextResponse.json({ ok: true, eligible: 0, synced: 0, failed: 0 });

  let synced = 0;
  let failed = 0;
  const failures: Array<{ clientId: string; quoteId: string; error: string }> = [];

  for (const generation of activeGenerations) {
    if (!generation.quickbooks_estimate_id) continue;
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
      const invoiceTotal = rows.reduce((sum, row) => sum + (row.total ?? 0), 0);
      const quoteTotal = numberOrNull(estimate?.TotalAmt);
      const priceInvoiceMatch = !rows.length
        ? ""
        : quoteTotal !== null && Math.abs(quoteTotal - invoiceTotal) < 0.005
          ? "Yes"
          : "ERROR - MISMATCH";
      const syncedAt = new Date().toISOString();
      const { error: generationUpdateError } = await supabaseAdmin
        .from("estimate_generations")
        .update({
          quote_total: quoteTotal,
          invoice_count: rows.length,
          invoice_total: invoiceTotal,
          price_invoice_match: priceInvoiceMatch,
          last_invoice_synced_at: syncedAt,
        })
        .eq("id", generation.id);
      if (generationUpdateError) throw generationUpdateError;

      synced += 1;
    } catch (error) {
      failed += 1;
      failures.push({
        clientId: generation.client_id,
        quoteId: generation.id,
        error: error instanceof Error ? error.message : "Invoice sync failed",
      });
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    eligible: activeGenerations.length,
    synced,
    failed,
    failures,
  });
}

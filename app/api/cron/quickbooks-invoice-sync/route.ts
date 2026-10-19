import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { qboQuery, qboRequest } from "@/lib/quickbooks/api";
import { getSystemLabel } from "@/lib/system-labels";
import { refreshClientTrackingRollups } from "@/lib/quickbooks/tracking-rollups";
import {
  invoiceSnapshot,
  isMissingQuickBooksObject,
  type QuickBooksInvoiceRecord,
} from "@/lib/quickbooks/invoice-records";

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

  let paidPaymentLabel;
  let partiallyPaidPaymentLabel;
  try {
    [paidPaymentLabel, partiallyPaidPaymentLabel] = await Promise.all([
      getSystemLabel(
        "tracking_invoice_payment_status",
        "tracking_invoice_payment_status_paid",
      ),
      getSystemLabel(
        "tracking_invoice_payment_status",
        "tracking_invoice_payment_status_partially_paid",
      ),
    ]);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invoice payment status labels are not configured.",
      },
      { status: 500 },
    );
  }

  let synced = 0;
  let failed = 0;
  let removedQuotes = 0;
  let directInvoicesSynced = 0;
  let directInvoicesRemoved = 0;
  const syncedClientIds = new Set<string>();
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
      const { data: stored, error: storedError } = await supabaseAdmin
        .from("quickbooks_estimate_invoices")
        .select("quickbooks_invoice_id, link_source")
        .eq("estimate_generation_id", generation.id);
      if (storedError) throw storedError;
      const manualInvoiceIds = new Set(
        (stored ?? [])
          .filter((row) => row.link_source === "manual")
          .map((row) => row.quickbooks_invoice_id),
      );
      const linked = invoices.filter(
        (invoice) =>
          invoice.Id &&
          (linksToEstimate(invoice, String(generation.quickbooks_estimate_id)) ||
            manualInvoiceIds.has(String(invoice.Id))),
      ) as QuickBooksInvoiceRecord[];
      for (const invoiceId of manualInvoiceIds) {
        if (linked.some((invoice) => String(invoice.Id) === invoiceId)) continue;
        try {
          const invoiceResult = await qboRequest(
            `/invoice/${encodeURIComponent(invoiceId)}`,
            { method: "GET" },
          );
          if (invoiceResult?.Invoice?.Id)
            linked.push(invoiceResult.Invoice as QuickBooksInvoiceRecord);
        } catch (error) {
          if (!isMissingQuickBooksObject(error)) throw error;
        }
      }
      const rows = linked.map((invoice) => ({
          estimate_generation_id: generation.id,
          ...invoiceSnapshot(invoice),
          link_source: manualInvoiceIds.has(String(invoice.Id))
            ? "manual"
            : "quickbooks",
        }));
      const ids = new Set(rows.map((row) => row.quickbooks_invoice_id));
      const staleIds = (stored ?? [])
        .map((row) => row.quickbooks_invoice_id)
        .filter((id) => !ids.has(id));
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
      const invoiceSubtotal = rows.reduce((sum, row) => sum + (row.subtotal ?? 0), 0);
      const totalBalance = rows.reduce((sum, row) => sum + (row.balance ?? 0), 0);
      const quoteTotal = numberOrNull(estimate?.TotalAmt);
      const quoteTaxTotal = numberOrNull(estimate?.TxnTaxDetail?.TotalTax) ?? 0;
      const quoteSubtotal = quoteTotal === null ? null : quoteTotal - quoteTaxTotal;
      const invoicePaymentLabel = !rows.length
        ? null
        : Math.abs(totalBalance) < 0.005
          ? paidPaymentLabel
          : totalBalance < invoiceTotal
            ? partiallyPaidPaymentLabel
            : null;
      const syncedAt = new Date().toISOString();
      const { error: generationUpdateError } = await supabaseAdmin
        .from("estimate_generations")
        .update({
          quote_total: quoteTotal,
          quote_subtotal: quoteSubtotal,
          invoice_count: rows.length,
          invoice_total: invoiceTotal,
          invoice_subtotal: invoiceSubtotal,
          total_balance: totalBalance,
          invoice_payment_status: invoicePaymentLabel?.value ?? null,
          invoice_payment_status_option_id: invoicePaymentLabel?.id ?? null,
          last_invoice_synced_at: syncedAt,
        })
        .eq("id", generation.id);
      if (generationUpdateError) throw generationUpdateError;

      syncedClientIds.add(generation.client_id);
      synced += 1;
    } catch (error) {
      if (isMissingQuickBooksObject(error)) {
        const { error: archiveError } = await supabaseAdmin
          .from("estimate_generations")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", generation.id);
        if (!archiveError) {
          syncedClientIds.add(generation.client_id);
          removedQuotes += 1;
          continue;
        }
      }
      failed += 1;
      failures.push({
        clientId: generation.client_id,
        quoteId: generation.id,
        error: error instanceof Error ? error.message : "Invoice sync failed",
      });
    }
  }

  const { data: directInvoices, error: directInvoicesError } = await supabaseAdmin
    .from("quickbooks_client_invoices")
    .select("id, client_id, quickbooks_invoice_id");
  if (directInvoicesError) {
    failed += 1;
    failures.push({
      clientId: "direct-invoices",
      quoteId: "direct-invoices",
      error: directInvoicesError.message,
    });
  } else {
    for (const storedInvoice of directInvoices ?? []) {
      try {
        const invoiceResult = await qboRequest(
          `/invoice/${encodeURIComponent(storedInvoice.quickbooks_invoice_id)}`,
          { method: "GET" },
        );
        const invoice = invoiceResult?.Invoice as QuickBooksInvoiceRecord | undefined;
        if (!invoice?.Id) throw new Error("QuickBooks returned an invalid invoice.");
        const { error: updateError } = await supabaseAdmin
          .from("quickbooks_client_invoices")
          .update(invoiceSnapshot(invoice))
          .eq("id", storedInvoice.id);
        if (updateError) throw updateError;
        syncedClientIds.add(storedInvoice.client_id);
        directInvoicesSynced += 1;
      } catch (error) {
        if (isMissingQuickBooksObject(error)) {
          const { error: deleteError } = await supabaseAdmin
            .from("quickbooks_client_invoices")
            .delete()
            .eq("id", storedInvoice.id);
          if (!deleteError) {
            syncedClientIds.add(storedInvoice.client_id);
            directInvoicesRemoved += 1;
            continue;
          }
        }
        failed += 1;
        failures.push({
          clientId: storedInvoice.client_id,
          quoteId: `direct-invoice:${storedInvoice.id}`,
          error: error instanceof Error ? error.message : "Direct invoice sync failed",
        });
      }
    }
  }

  for (const clientId of syncedClientIds) {
    try {
      await refreshClientTrackingRollups(clientId);
    } catch (error) {
      failed += 1;
      failures.push({
        clientId,
        quoteId: "client-rollup",
        error:
          error instanceof Error
            ? error.message
            : "Client Tracking rollup failed",
      });
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    eligible: activeGenerations.length,
    synced,
    removedQuotes,
    directInvoicesSynced,
    directInvoicesRemoved,
    failed,
    failures,
  });
}

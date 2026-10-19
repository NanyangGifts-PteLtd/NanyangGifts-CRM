import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSystemLabel, type SystemLabel } from "@/lib/system-labels";

type NullableLabel = SystemLabel | null;

async function trackingLabels() {
  const [paid, partiallyPaid] =
    await Promise.all([
      getSystemLabel("tracking_invoice_payment_status", "tracking_invoice_payment_status_paid"),
      getSystemLabel("tracking_invoice_payment_status", "tracking_invoice_payment_status_partially_paid"),
    ]);
  return { paid, partiallyPaid };
}

function labelValues(label: NullableLabel) {
  return label
    ? { value: label.value, optionId: label.id }
    : { value: null, optionId: null };
}

/** Recomputes the two client-level summaries from every active quote. */
export async function refreshClientTrackingRollups(clientId: string) {
  const [{ data: quotes, error: quotesError }, labels] = await Promise.all([
    supabaseAdmin
      .from("estimate_generations")
      .select("id, invoice_payment_status_option_id")
      .eq("client_id", clientId)
      .is("archived_at", null),
    trackingLabels(),
  ]);
  if (quotesError) throw quotesError;

  const activeQuotes = quotes ?? [];

  const quoteIds = activeQuotes.map((quote) => quote.id);
  const [quoteInvoicesResult, directInvoicesResult] = await Promise.all([
    quoteIds.length
      ? supabaseAdmin
          .from("quickbooks_estimate_invoices")
          .select("estimate_generation_id, quickbooks_invoice_doc_number, invoice_date, total, balance, is_voided")
          .in("estimate_generation_id", quoteIds)
          .order("invoice_date", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin
      .from("quickbooks_client_invoices")
      .select("quickbooks_invoice_doc_number, invoice_date, total, balance, is_voided")
      .eq("client_id", clientId)
      .order("invoice_date", { ascending: false }),
  ]);
  if (quoteInvoicesResult.error) throw quoteInvoicesResult.error;
  if (directInvoicesResult.error) throw directInvoicesResult.error;
  const invoices = [
    ...(quoteInvoicesResult.data ?? []),
    ...(directInvoicesResult.data ?? []),
  ];
  const invoiceNumbers = Array.from(
    new Set(
      invoices
        .map((invoice) => invoice.quickbooks_invoice_doc_number?.trim())
        .filter((number): number is string => Boolean(number)),
    ),
  ).join(", ");

  const quoteIdsWithActiveInvoices = new Set(
    (quoteInvoicesResult.data ?? [])
      .filter((invoice) => !invoice.is_voided)
      .map((invoice) => invoice.estimate_generation_id),
  );
  const paymentIds: Array<string | null> = activeQuotes
    .filter((quote) => quoteIdsWithActiveInvoices.has(quote.id))
    .map(
      (quote) => String(quote.invoice_payment_status_option_id ?? "") || null,
    );
  for (const invoice of directInvoicesResult.data ?? []) {
    if (invoice.is_voided) continue;
    const total = Number(invoice.total ?? 0);
    const balance = Number(invoice.balance ?? 0);
    paymentIds.push(
      Math.abs(balance) < 0.005
        ? labels.paid.id
        : balance < total
          ? labels.partiallyPaid.id
          : null,
    );
  }

  let overallPayment: NullableLabel = null;
  if (
    paymentIds.length > 0 &&
    paymentIds.every((optionId) => optionId === labels.paid.id)
  ) {
    overallPayment = labels.paid;
  } else if (paymentIds.some(Boolean)) {
    overallPayment = labels.partiallyPaid;
  }

  const payment = labelValues(overallPayment);
  const { error: totalsError } = await supabaseAdmin.rpc(
    "refresh_tracking_client_totals",
    { p_client_id: clientId },
  );
  if (totalsError) throw totalsError;
  const { error: updateError } = await supabaseAdmin
    .from("clients")
    .update({
      tracking_overall_invoice_payment_status: payment.value,
      tracking_overall_invoice_payment_status_option_id: payment.optionId,
      tracking_invoice_numbers: invoiceNumbers,
    })
    .eq("id", clientId);
  if (updateError) throw updateError;
}

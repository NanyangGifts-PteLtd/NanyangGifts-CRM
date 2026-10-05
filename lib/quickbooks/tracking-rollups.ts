import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSystemLabel, type SystemLabel } from "@/lib/system-labels";

type NullableLabel = SystemLabel | null;

async function trackingLabels() {
  const [mismatch, partiallyInvoiced, yes, verified, paid, partiallyPaid] =
    await Promise.all([
      getSystemLabel("tracking_price_invoice_match", "tracking_price_invoice_match_mismatch"),
      getSystemLabel("tracking_price_invoice_match", "tracking_price_invoice_match_partially_invoiced"),
      getSystemLabel("tracking_price_invoice_match", "tracking_price_invoice_match_yes"),
      getSystemLabel("tracking_price_invoice_match", "tracking_price_invoice_match_verified"),
      getSystemLabel("tracking_invoice_payment_status", "tracking_invoice_payment_status_paid"),
      getSystemLabel("tracking_invoice_payment_status", "tracking_invoice_payment_status_partially_paid"),
    ]);
  return { mismatch, partiallyInvoiced, yes, verified, paid, partiallyPaid };
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
      .select("price_invoice_match_option_id, invoice_payment_status_option_id")
      .eq("client_id", clientId)
      .is("archived_at", null),
    trackingLabels(),
  ]);
  if (quotesError) throw quotesError;

  const activeQuotes = quotes ?? [];
  const matchIds = activeQuotes.map((quote) =>
    String(quote.price_invoice_match_option_id ?? "") || null,
  );
  const paymentIds = activeQuotes.map((quote) =>
    String(quote.invoice_payment_status_option_id ?? "") || null,
  );

  let overallMatch: NullableLabel = null;
  if (matchIds.includes(labels.mismatch.id)) {
    overallMatch = labels.mismatch;
  } else if (matchIds.includes(labels.partiallyInvoiced.id)) {
    overallMatch = labels.partiallyInvoiced;
  } else if (
    matchIds.length > 0 &&
    matchIds.every(
      (optionId) => optionId === labels.yes.id || optionId === labels.verified.id,
    )
  ) {
    overallMatch = labels.yes;
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

  const match = labelValues(overallMatch);
  const payment = labelValues(overallPayment);
  const { error: updateError } = await supabaseAdmin
    .from("clients")
    .update({
      tracking_overall_price_invoice_match: match.value,
      tracking_overall_price_invoice_match_option_id: match.optionId,
      tracking_overall_invoice_payment_status: payment.value,
      tracking_overall_invoice_payment_status_option_id: payment.optionId,
    })
    .eq("id", clientId);
  if (updateError) throw updateError;
}

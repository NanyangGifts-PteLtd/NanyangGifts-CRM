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
      .select("invoice_payment_status_option_id")
      .eq("client_id", clientId)
      .is("archived_at", null),
    trackingLabels(),
  ]);
  if (quotesError) throw quotesError;

  const activeQuotes = quotes ?? [];
  const paymentIds = activeQuotes.map((quote) =>
    String(quote.invoice_payment_status_option_id ?? "") || null,
  );

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
    })
    .eq("id", clientId);
  if (updateError) throw updateError;
}

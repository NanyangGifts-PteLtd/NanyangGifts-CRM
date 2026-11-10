import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currencyToSgdRate } from "@/lib/currency-labels";

type Label = { id: string | null; value: string; systemKey?: string | null };

export async function mergePaymentVoucherSubitem({
  clientId, subitemId, voucherId, name, cost, currency, status, orderNumber,
  modeOfPayment, paymentDone, paidStatus, quickBooksBillId,
}: {
  clientId: string; subitemId: string; voucherId: string; name: string;
  cost: number; currency: Label; status: Label; orderNumber: string;
  modeOfPayment: Label; paymentDone: Label; paidStatus: Label;
  quickBooksBillId?: string;
}) {
  const subitem = await validatePaymentVoucherMergeTarget(clientId, subitemId);
  const { data: existingCurrency } = subitem.currency_option_id
    ? await supabaseAdmin.from("option_values").select("system_key").eq("id", subitem.currency_option_id).maybeSingle()
    : { data: null };
  const { data: voucherCurrency } = currency.id
    ? await supabaseAdmin.from("option_values").select("system_key").eq("id", currency.id).maybeSingle()
    : { data: null };
  const oldSgd = Math.max(0, Number(subitem.cost) || 0) * currencyToSgdRate(existingCurrency?.system_key);
  const newSgd = cost * currencyToSgdRate(voucherCurrency?.system_key ?? currency.systemKey);
  const variation = oldSgd === 0 || newSgd > oldSgd * 1.2;
  const { data: variationLabel, error: variationError } = await supabaseAdmin
    .from("option_values").select("id, value").eq("system_key", "subitem_status_variation_cost_difference").maybeSingle();
  const { data: verifiedLabel, error: verifiedError } = await supabaseAdmin
    .from("option_values").select("id, value").eq("system_key", "subitem_status_verified").maybeSingle();
  if (variationError || verifiedError || !variationLabel || !verifiedLabel)
    throw new Error("Payment Voucher subitem statuses could not be identified.");
  const targetStatus = variation ? variationLabel : verifiedLabel;
  const { error: updateError } = await supabaseAdmin.from("subitems").update({
    name, status: targetStatus.value, status_option_id: targetStatus.id, qty: "1",
    currency: currency.value, currency_option_id: currency.id, cost: String(cost),
    payment_amount: String(cost), difference: "0", payment_status: paidStatus.value,
    payment_status_option_id: paidStatus.id,
    custom_fields: { ...(subitem.custom_fields ?? {}), additionalCostId: voucherId, additionalCostLinked: "true", ...(quickBooksBillId ? { quickBooksBillId } : {}) },
  }).eq("id", subitemId);
  if (updateError) throw updateError;
  const { error: deleteError } = await supabaseAdmin.from("subitem_payment_rows").delete().eq("subitem_id", subitemId);
  if (deleteError) throw deleteError;
  const { error: paymentError } = await supabaseAdmin.from("subitem_payment_rows").insert({
    subitem_id: subitemId, position: 0, amount: String(cost), order_number: orderNumber,
    payment_received: true, payment_received_label: paymentDone.value,
    payment_received_option_id: paymentDone.id, mode_of_payment: modeOfPayment.value,
    mode_of_payment_option_id: modeOfPayment.id,
  });
  if (paymentError) throw paymentError;
  return { subitemId, status: targetStatus };
}

export async function validatePaymentVoucherMergeTarget(clientId: string, subitemId: string) {
  const { data: subitem, error } = await supabaseAdmin
    .from("subitems")
    .select("id, cost, currency_option_id, custom_fields")
    .eq("id", subitemId).eq("client_id", clientId).is("deleted_at", null).maybeSingle();
  if (error || !subitem) throw new Error("The selected merge subitem is no longer available.");
  if (subitem.custom_fields?.additionalCostId)
    throw new Error("Payment Voucher subitems cannot be merged into.");
  return subitem;
}

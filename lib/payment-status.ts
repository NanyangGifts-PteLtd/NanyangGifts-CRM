import { findSystemOption, type OptionEntry } from "./board-labels";

export function automaticPaymentStatus(
  difference: number,
  options: OptionEntry[],
) {
  return Math.abs(difference) < 0.005
    ? findSystemOption(options, "payment_status_paid", "✅").value
    : findSystemOption(options, "payment_status_mismatch", "MISMATCH").value;
}

export function overallPaymentStatus(
  awardedCount: number,
  paidCount: number,
  options: OptionEntry[],
) {
  if (!awardedCount) return "";
  if (!paidCount)
    return findSystemOption(options, "overall_payment_status_unpaid", "Unpaid")
      .value;
  if (paidCount === awardedCount)
    return findSystemOption(
      options,
      "overall_payment_status_fully_paid",
      "Fully Paid",
    ).value;
  return findSystemOption(
    options,
    "overall_payment_status_mismatch",
    "MISMATCH",
  ).value;
}

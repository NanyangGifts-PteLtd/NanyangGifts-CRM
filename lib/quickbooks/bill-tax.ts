export function quickBooksBillGstTotal(bill: unknown): number | null {
  const totalTax = Number(
    (bill as { TxnTaxDetail?: { TotalTax?: unknown } } | null)?.TxnTaxDetail
      ?.TotalTax,
  );

  return Number.isFinite(totalTax) ? totalTax : null;
}

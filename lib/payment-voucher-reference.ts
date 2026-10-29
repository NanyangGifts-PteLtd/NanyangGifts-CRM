/** Formats the shared numeric voucher allocator as the public PV reference. */
export function formatPaymentVoucherReference(value: unknown) {
  const reference = String(value ?? "").trim();
  if (!reference) throw new Error("Payment Voucher reference was not allocated.");
  if (/^pv/i.test(reference)) return `PV${reference.slice(2)}`;
  return `PV${reference}`;
}

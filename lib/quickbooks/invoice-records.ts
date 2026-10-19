import "server-only";

export type QuickBooksInvoiceRecord = {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number | string;
  Balance?: number | string;
  TxnTaxDetail?: { TotalTax?: number | string };
  LinkedTxn?: Array<{ TxnId?: string; TxnType?: string }>;
  Line?: Array<{ LinkedTxn?: Array<{ TxnId?: string; TxnType?: string }> }>;
  [key: string]: unknown;
};

export function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function invoiceEstimateIds(invoice: QuickBooksInvoiceRecord) {
  return [
    ...(invoice.LinkedTxn ?? []),
    ...(invoice.Line ?? []).flatMap((line) => line.LinkedTxn ?? []),
  ]
    .filter(
      (link) =>
        link.TxnType?.toLowerCase() === "estimate" && Boolean(link.TxnId),
    )
    .map((link) => String(link.TxnId));
}

export function isMissingQuickBooksObject(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const jsonStart = message.indexOf("{");
  if (jsonStart < 0) return /not found|object.*deleted/i.test(message);
  try {
    const payload = JSON.parse(message.slice(jsonStart));
    return String(payload?.Fault?.Error?.[0]?.code) === "610";
  } catch {
    return /not found|object.*deleted/i.test(message);
  }
}

export function invoiceSnapshot(invoice: QuickBooksInvoiceRecord) {
  if (!invoice.Id)
    throw new Error("QuickBooks returned an invoice without an ID.");
  const total = numberOrNull(invoice.TotalAmt);
  const taxTotal = numberOrNull(invoice.TxnTaxDetail?.TotalTax) ?? 0;
  return {
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
}

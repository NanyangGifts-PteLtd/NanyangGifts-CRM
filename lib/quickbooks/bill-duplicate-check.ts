import { qboQuery } from "@/lib/quickbooks/api";

function quoteQueryValue(value: string) {
  // QuickBooks SQL-style queries escape literal apostrophes with a backslash.
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * QuickBooks does not enforce a per-vendor document-number constraint for us.
 * Check its current Bills immediately before a create/update so the rule also
 * covers Bills that originated outside this CRM.
 */
export async function ensureQuickBooksBillNumberAvailable({
  supplierId,
  billNumber,
  excludeBillId,
}: {
  supplierId: string;
  billNumber: string;
  excludeBillId?: string;
}) {
  const vendor = quoteQueryValue(supplierId.trim());
  const documentNumber = quoteQueryValue(billNumber.trim());
  const result = await qboQuery(
    `SELECT Id, DocNumber, VendorRef FROM Bill WHERE VendorRef = '${vendor}' AND DocNumber = '${documentNumber}'`,
  );
  const duplicate = (result?.QueryResponse?.Bill ?? []).find(
    (bill: { Id?: string }) => String(bill.Id ?? "") !== String(excludeBillId ?? ""),
  );
  if (duplicate) {
    throw new Error(
      `Invoice no. \"${billNumber}\" already exists for this Supplier in QuickBooks.`,
    );
  }
}

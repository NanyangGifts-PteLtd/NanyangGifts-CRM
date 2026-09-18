import { createClient } from "@/lib/supabase/server";
import { qboQuery } from "@/lib/quickbooks/api";

export async function authorizeQuickBooksBillRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
}

function activeRows(result: any, key: string) {
  return (result?.QueryResponse?.[key] ?? []).filter(
    (row: { Active?: boolean | null }) => row.Active !== false,
  );
}

// QuickBooks query responses are paginated. The default response only
// contains the first page, which silently hid older suppliers/accounts.
async function allActiveRows(query: string, key: string) {
  const pageSize = 500;
  const rows: any[] = [];
  const seen = new Set<string>();
  for (let startPosition = 1; startPosition <= 50_000; startPosition += pageSize) {
    const result = await qboQuery(
      `${query} STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`,
    );
    const page = activeRows(result, key);
    for (const row of page) {
      const id = String(row.Id ?? "");
      if (id && !seen.has(id)) {
        seen.add(id);
        rows.push(row);
      }
    }
    const totalCount = Number(result?.QueryResponse?.totalCount ?? 0);
    if (!page.length || page.length < pageSize || (totalCount && rows.length >= totalCount)) break;
  }
  return rows;
}

export async function listQuickBooksVendors() {
  const vendors = await allActiveRows("SELECT * FROM Vendor WHERE Active = true", "Vendor");
  return vendors
    .map((vendor: any) => ({
      id: String(vendor.Id),
      name: String(vendor.DisplayName ?? vendor.CompanyName ?? "Unnamed supplier"),
      companyName: String(vendor.CompanyName ?? ""),
      email: String(vendor.PrimaryEmailAddr?.Address ?? ""),
      phone: String(vendor.PrimaryPhone?.FreeFormNumber ?? ""),
      balance: Number(vendor.Balance ?? 0),
    }))
    .sort((first: { name: string }, second: { name: string }) =>
      first.name.localeCompare(second.name),
    );
}

export async function listQuickBooksExpenseAccounts() {
  const accounts = await allActiveRows("SELECT * FROM Account WHERE Active = true", "Account");
  const eligibleTypes = new Set(["Expense", "Cost of Goods Sold", "Other Expense"]);
  return accounts
    .filter((account: { AccountType?: string }) =>
      eligibleTypes.has(String(account.AccountType ?? "")),
    )
    .map((account: any) => ({
      id: String(account.Id),
      name: String(account.FullyQualifiedName ?? account.Name ?? "Unnamed account"),
      accountType: String(account.AccountType ?? ""),
      accountSubType: String(account.AccountSubType ?? ""),
    }))
    .sort((first: { name: string }, second: { name: string }) =>
      first.name.localeCompare(second.name),
    );
}

export async function listQuickBooksTerms() {
  const terms = await allActiveRows("SELECT * FROM Term WHERE Active = true", "Term");
  return terms
    .map((term: any) => ({
      id: String(term.Id),
      name: String(term.Name ?? "Unnamed term"),
      type: String(term.Type ?? ""),
      dueDays: Number(term.DueDays ?? 0),
    }))
    .sort((first: { name: string }, second: { name: string }) =>
      first.name.localeCompare(second.name),
    );
}

export async function listQuickBooksTaxCodes() {
  const taxCodes = await allActiveRows("SELECT * FROM TaxCode WHERE Active = true", "TaxCode");
  const taxRates = await allActiveRows("SELECT * FROM TaxRate WHERE Active = true", "TaxRate");
  const rateById = new Map(
    taxRates.map((taxRate: any) => [
      String(taxRate.Id ?? ""),
      Number(taxRate.RateValue ?? 0),
    ]),
  );
  return taxCodes
    .map((taxCode: any) => ({
      id: String(taxCode.Id),
      name: String(taxCode.Name ?? "Unnamed tax code"),
      taxable: Boolean(taxCode.Taxable),
      // Bills are purchase transactions, so use the purchase-rate list.
      rate: (taxCode.PurchaseTaxRateList?.TaxRateDetail ?? []).reduce(
        (total: number, detail: any) =>
          total + (rateById.get(String(detail.TaxRateRef?.value ?? "")) ?? 0),
        0,
      ),
    }))
    .sort((first: { name: string }, second: { name: string }) =>
      first.name.localeCompare(second.name),
    );
}

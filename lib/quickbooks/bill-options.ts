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

export async function listQuickBooksVendors() {
  const result = await qboQuery("SELECT * FROM Vendor WHERE Active = true");
  return activeRows(result, "Vendor")
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
  const result = await qboQuery("SELECT * FROM Account WHERE Active = true");
  const eligibleTypes = new Set(["Expense", "Cost of Goods Sold", "Other Expense"]);
  return activeRows(result, "Account")
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
  const result = await qboQuery("SELECT * FROM Term WHERE Active = true");
  return activeRows(result, "Term")
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
  const result = await qboQuery("SELECT * FROM TaxCode WHERE Active = true");
  return activeRows(result, "TaxCode")
    .map((taxCode: any) => ({
      id: String(taxCode.Id),
      name: String(taxCode.Name ?? "Unnamed tax code"),
      taxable: Boolean(taxCode.Taxable),
    }))
    .sort((first: { name: string }, second: { name: string }) =>
      first.name.localeCompare(second.name),
    );
}

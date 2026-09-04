import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { qboQuery, qboRequest } from "@/lib/quickbooks/api";

const ELIGIBLE = new Set(["Quoted", "Shortlisted", "Awarded"]);

const esc = (value: string) => value.replace(/'/g, "\\'");
const numberValue = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

function quickBooksErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf("{")));
    const fault = parsed?.Fault?.Error?.[0];
    if (String(fault?.code) === "610") {
      return "QuickBooks could not find this estimate. It may have been deleted or made inactive in QuickBooks.";
    }
    return fault?.Detail || fault?.Message || raw;
  } catch {
    return raw || "Could not load QuickBooks estimate";
  }
}

type QuickBooksInvoice = {
  Id?: string;
  DocNumber?: string;
  LinkedTxn?: Array<{ TxnId?: string; TxnType?: string }>;
  Line?: Array<{
    LinkedTxn?: Array<{ TxnId?: string; TxnType?: string }>;
  }>;
};

function invoiceLinksToEstimate(invoice: QuickBooksInvoice, estimateId: string) {
  const links = [
    ...(invoice.LinkedTxn ?? []),
    ...(invoice.Line ?? []).flatMap((line) => line.LinkedTxn ?? []),
  ];
  return links.some(
    (link) =>
      link.TxnType?.toLowerCase() === "estimate" &&
      String(link.TxnId) === estimateId,
  );
}

async function linkedInvoicesForEstimate(estimate: any) {
  const customerId = String(estimate?.CustomerRef?.value ?? "");
  if (!customerId || !estimate?.Id) return [] as QuickBooksInvoice[];
  const response = await qboQuery(
    `SELECT * FROM Invoice WHERE CustomerRef = '${esc(customerId)}'`,
  );
  const invoices = (response?.QueryResponse?.Invoice ?? []) as QuickBooksInvoice[];
  return invoices.filter((invoice) => invoiceLinksToEstimate(invoice, String(estimate.Id)));
}

async function getOrCreateItem(subitem: any) {
  const name = String(subitem.name ?? "").trim();
  if (!name) throw new Error("Subitem name missing");
  const existing = await qboQuery(`SELECT * FROM Item WHERE Name = '${esc(name)}'`);
  const found = existing?.QueryResponse?.Item?.[0];
  if (found) return found;
  const created = await qboRequest("/item", {
    method: "POST",
    body: JSON.stringify({
      Name: name,
      Type: "NonInventory",
      IncomeAccountRef: { value: process.env.QUICKBOOKS_INCOME_ACCOUNT_ID! },
      SalesTaxCodeRef: { value: "59" },
    }),
  });
  return created.Item;
}

const customFields = (existingFields: any[], salesperson: string, paymentTerm: string) => [
  // Keep any pre-existing sales-form fields (such as PO Number) intact. Only
  // the two CRM-managed field slots are replaced.
  ...(existingFields ?? []).filter(
    (field) => !["2", "3"].includes(String(field.DefinitionId)),
  ),
  ...(paymentTerm ? [{ DefinitionId: "2", Type: "StringType", StringValue: paymentTerm }] : []),
  { DefinitionId: "3", Type: "StringType", StringValue: salesperson },
];

function incomingPreview(client: any) {
  const lines = (client.subitems ?? [])
    .filter((item: any) => ELIGIBLE.has(String(item.status ?? "").trim()))
    .sort((a: any, b: any) => Number(a.position ?? Number.MAX_SAFE_INTEGER) - Number(b.position ?? Number.MAX_SAFE_INTEGER))
    .map((item: any) => {
      const qty = numberValue(item.qty) || 1;
      const unitPrice = numberValue(item.up) || numberValue(item.price) / qty;
      return {
        name: item.name || "Unnamed item",
        description: item.description || item.name || "Unnamed item",
        qty,
        unitPrice,
        amount: qty * unitPrice,
        taxCode: String(item.local_overseas ?? "").trim().toLowerCase() === "overseas" ? "21" : "59",
      };
    });
  const subtotal = lines.reduce((sum: number, line: any) => sum + line.amount, 0);
  const tax = lines.reduce(
    (sum: number, line: any) => sum + (line.taxCode === "59" ? line.amount * 0.09 : 0),
    0,
  );
  return { lines, subtotal, tax, total: subtotal + tax };
}

async function canEditClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  userId: string,
) {
  const [{ data: profile, error: profileError }, { data: assignment, error: assignmentError }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase.from("client_assignees").select("user_id").eq("client_id", clientId).eq("user_id", userId).maybeSingle(),
  ]);
  if (profileError || assignmentError) throw profileError ?? assignmentError;
  const role = String(profile?.role ?? "").toLowerCase();
  return ["admin", "director", "dev"].includes(role) || Boolean(assignment);
}

async function authorisedGeneration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  generationId: string,
  userId: string,
) {
  const { data: generation, error } = await supabase
    .from("estimate_generations")
    .select("id, client_id, quickbooks_estimate_id, quickbooks_estimate_doc_number, created_at")
    .eq("id", generationId)
    .maybeSingle();
  if (error || !generation?.quickbooks_estimate_id) throw new Error("QuickBooks estimate record not found");
  if (!(await canEditClient(supabase, generation.client_id, userId))) {
    throw new Error("You must be assigned to this client to update its QuickBooks estimates");
  }
  const { data: client } = await supabase
    .from("clients")
    .select("*, subitems(*)")
    .eq("id", generation.client_id)
    .maybeSingle();
  if (!client) throw new Error("Client not found");
  return { generation, client };
}

const currentPreview = (estimate: any) => ({
  id: estimate.Id,
  syncToken: estimate.SyncToken,
  docNumber: estimate.DocNumber,
  customer: estimate.CustomerRef?.name ?? "",
  total: Number(estimate.TotalAmt ?? 0),
  paymentTerm:
    (estimate.CustomField ?? []).find(
      (field: any) => String(field.DefinitionId) === "2",
    )?.StringValue ?? "",
  lines: (estimate.Line ?? [])
    .filter((line: any) => line.DetailType === "SalesItemLineDetail")
    .map((line: any) => ({
      name: line.SalesItemLineDetail?.ItemRef?.name ?? "Item",
      description: line.Description ?? "",
      qty: Number(line.SalesItemLineDetail?.Qty ?? 0),
      unitPrice: Number(line.SalesItemLineDetail?.UnitPrice ?? 0),
      amount: Number(line.Amount ?? 0),
      taxCode: line.SalesItemLineDetail?.TaxCodeRef?.value ?? "",
    })),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const generationId = request.nextUrl.searchParams.get("generationId");
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (generationId) {
      const { generation, client } = await authorisedGeneration(supabase, generationId, user.id);
      const result = await qboRequest(`/estimate/${generation.quickbooks_estimate_id}`, { method: "GET" });
      const linkedInvoices = await linkedInvoicesForEstimate(result.Estimate);
      return NextResponse.json({
        generation,
        current: currentPreview(result.Estimate),
        incoming: incomingPreview(client),
        isInvoiced: linkedInvoices.length > 0,
        invoiceDocNumbers: linkedInvoices.map((invoice) => invoice.DocNumber ?? invoice.Id).filter(Boolean),
      });
    }
    if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    if (!(await canEditClient(supabase, clientId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { data: estimates, error } = await supabase
      .from("estimate_generations")
      .select("id, quickbooks_estimate_id, quickbooks_estimate_doc_number, created_at")
      .eq("client_id", clientId)
      .not("quickbooks_estimate_id", "is", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ estimates: estimates ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: quickBooksErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { estimateGenerationId, paymentTerm: suppliedPaymentTerm } = await request.json();
    if (!estimateGenerationId) return NextResponse.json({ error: "Missing estimateGenerationId" }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { generation, client } = await authorisedGeneration(supabase, estimateGenerationId, user.id);
    const currentResult = await qboRequest(`/estimate/${generation.quickbooks_estimate_id}`, { method: "GET" });
    const current = currentResult.Estimate;
    if (!current?.SyncToken) throw new Error("QuickBooks estimate is missing its update token");
    const linkedInvoices = await linkedInvoicesForEstimate(current);
    if (linkedInvoices.length) {
      const invoiceNumbers = linkedInvoices
        .map((invoice) => invoice.DocNumber ?? invoice.Id)
        .filter(Boolean)
        .join(", ");
      throw new Error(
        `This QuickBooks estimate already has an invoice (${invoiceNumbers}). It cannot be updated from the CRM.`,
      );
    }
    const preview = incomingPreview(client);
    if (!preview.lines.length) throw new Error("No eligible subitems with Quoted, Shortlisted, or Awarded status");
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
    const salesperson = profile?.full_name?.trim() || profile?.email || user.email || "CRM user";
    const paymentTerm = String(suppliedPaymentTerm ?? "").trim().slice(0, 200);
    const lines = await Promise.all(preview.lines.map(async (line: any, index: number) => {
      const item = await getOrCreateItem({ name: line.name });
      return {
        LineNum: index + 1,
        Amount: line.amount,
        Description: line.description,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: item.Id, name: item.Name },
          Qty: line.qty,
          UnitPrice: line.unitPrice,
          TaxCodeRef: { value: line.taxCode },
        },
      };
    }));
    const updatedResult = await qboRequest("/estimate", {
      method: "POST",
      body: JSON.stringify({
        Id: current.Id,
        SyncToken: current.SyncToken,
        sparse: false,
        CustomerRef: current.CustomerRef,
        TxnDate: current.TxnDate,
        ExpirationDate: current.ExpirationDate,
        BillAddr: current.BillAddr,
        ShipAddr: current.ShipAddr,
        BillEmail: current.BillEmail,
        CustomerMemo: current.CustomerMemo,
        PrivateNote: current.PrivateNote,
        TxnTaxDetail: current.TxnTaxDetail,
        CurrencyRef: current.CurrencyRef,
        ExchangeRate: current.ExchangeRate,
        DepartmentRef: current.DepartmentRef,
        SalesTermRef: current.SalesTermRef,
        Line: lines,
        CustomField: customFields(current.CustomField, salesperson, paymentTerm),
      }),
    });
    const updated = updatedResult.Estimate;
    await supabase.from("activity_log").insert({
      client_id: client.id,
      subitem_id: null,
      actor_name: salesperson,
      action: "estimate_updated",
      field_name: null,
      old_value: null,
      new_value: null,
      subitem_name: null,
      link: null,
      title: "updated a QuickBooks estimate",
      description: updated?.DocNumber ? `QuickBooks estimate ${updated.DocNumber}` : "QuickBooks estimate updated",
      meta: { kind: "quickbooks", estimateGenerationId, quickbooksEstimateId: current.Id },
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, estimateId: updated?.Id, docNumber: updated?.DocNumber ?? current.DocNumber });
  } catch (error: any) {
    console.error("QuickBooks estimate update failed", error);
    return NextResponse.json({ error: quickBooksErrorMessage(error) }, { status: 500 });
  }
}

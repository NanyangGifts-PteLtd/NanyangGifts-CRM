import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { qboQuery, qboRequest } from "@/lib/quickbooks/api";
import { getSystemLabel } from "@/lib/system-labels";
import { refreshClientTrackingRollups } from "@/lib/quickbooks/tracking-rollups";
import { archiveQuickBooksEstimatePdf } from "@/lib/quickbooks/estimate-pdf";

const ELIGIBLE_STATUS_KEYS = [
  "subitem_status_quoted",
  "subitem_status_shortlisted",
  "subitem_status_awarded",
] as const;
const isFreightLine = (name: unknown) => /\bfreight\b/i.test(String(name ?? ""));

const esc = (value: string) => value.replace(/'/g, "\\'");
const numberValue = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function addOneMonth(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)),
  )
    .toISOString()
    .slice(0, 10);
}

function dateOnly(value: unknown, fallback: string) {
  const candidate = String(value ?? "").trim();
  return DATE_ONLY.test(candidate) ? candidate : fallback;
}

function poFieldNameMatches(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "") === "ponumber";
}

type QuickBooksPoField = { definitionId: string; type: string };
type QuickBooksCustomField = {
  DefinitionId?: unknown;
  Name?: unknown;
  Type?: unknown;
  StringValue?: unknown;
  BooleanValue?: unknown;
  CustomField?: QuickBooksCustomField[];
};

async function quickBooksPoNumberField(): Promise<QuickBooksPoField | null> {
  const preferences = await qboRequest("/preferences", { method: "GET" });
  const groups = (preferences?.Preferences?.SalesFormsPrefs?.CustomField ??
    []) as QuickBooksCustomField[];
  const fields = groups.flatMap((group) => group.CustomField ?? [group]);
  const directField = fields.find(
    (field) =>
      poFieldNameMatches(field.Name) && String(field.DefinitionId ?? "").trim(),
  );
  if (directField) {
    return {
      definitionId: String(directField.DefinitionId),
      type: String(directField.Type || "StringType"),
    };
  }
  const nameField = fields.find((field) => poFieldNameMatches(field.StringValue));
  const match = String(nameField?.Name ?? "").match(/SalesCustomName(\d+)$/i);
  if (!match) return null;
  const slot = match[1];
  const enabled = fields.find(
    (field) =>
      String(field.Name ?? "").toLocaleLowerCase() ===
      `salesformsprefs.usesalescustom${slot}`.toLocaleLowerCase(),
  );
  if (enabled?.BooleanValue === false) return null;
  return { definitionId: slot, type: "StringType" };
}

function paymentTermForQuickBooks(value: string) {
  if (value === "50% deposit, 50% before delivery") {
    return "50% deposit, 50% pre-delivery";
  }
  if (value.length > 31) {
    throw new Error(
      "Payment Terms must be 31 characters or fewer for the configured QuickBooks field.",
    );
  }
  return value;
}

function poNumberFromEstimate(
  estimate: { CustomField?: QuickBooksCustomField[] },
  poField: QuickBooksPoField | null,
) {
  const field = (estimate.CustomField ?? []).find(
    (candidate: QuickBooksCustomField) =>
      (poField && String(candidate?.DefinitionId) === poField.definitionId) ||
      poFieldNameMatches(candidate?.Name),
  );
  return String(field?.StringValue ?? "");
}

async function eligibleSubitemStatusIds() {
  return new Set(
    (await Promise.all(
      ELIGIBLE_STATUS_KEYS.map((key) => getSystemLabel("subitem_status", key)),
    )).map((label) => label.id),
  );
}

function quickBooksErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf("{")));
    const fault = parsed?.Fault?.Error?.[0];
    if (String(fault?.code) === "610") {
      return "QuickBooks could not find this quote. It may have been deleted or made inactive in QuickBooks.";
    }
    return fault?.Detail || fault?.Message || raw;
  } catch {
    return raw || "Could not load QuickBooks quote";
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

const customFields = (
  existingFields: any[],
  salesperson: string,
  paymentTerm: string,
  poNumber: string,
  poField: QuickBooksPoField | null,
) => {
  if (poNumber && !poField) {
    throw new Error(
      'QuickBooks does not have an active sales-form custom field named "PO Number".',
    );
  }
  return [
  // Keep any pre-existing sales-form fields (such as PO Number) intact. Only
  // CRM-managed fields are replaced. The PO field is matched from the active
  // QuickBooks company preferences, never assumed to use a fixed slot.
  ...(existingFields ?? []).filter(
    (field) =>
      !["2", "3", ...(poField ? [poField.definitionId] : [])].includes(
        String(field.DefinitionId),
      ),
  ),
  ...(paymentTerm ? [{ DefinitionId: "2", Type: "StringType", StringValue: paymentTerm }] : []),
  { DefinitionId: "3", Type: "StringType", StringValue: salesperson },
  ...(poField
    ? [
        {
          DefinitionId: poField.definitionId,
          Type: poField.type,
          StringValue: poNumber,
        },
      ]
    : []),
];
};

function incomingPreview(
  client: any,
  eligibleStatusIds: Set<string>,
  deliveryBySubitem: Record<string, "singapore" | "other"> = {},
) {
  const lines = (client.subitems ?? [])
    .filter((item: any) => eligibleStatusIds.has(item.status_option_id))
    .sort((a: any, b: any) => Number(a.position ?? Number.MAX_SAFE_INTEGER) - Number(b.position ?? Number.MAX_SAFE_INTEGER))
    .map((item: any) => {
      const qty = numberValue(item.qty) || 1;
      const unitPrice = numberValue(item.up) || numberValue(item.price) / qty;
      return {
        id: item.id,
        name: item.name || "Unnamed item",
        description: item.description || item.name || "Unnamed item",
        qty,
        unitPrice,
        amount: qty * unitPrice,
        taxCode:
          isFreightLine(item.name)
            ? "21"
            : deliveryBySubitem[item.id] === "singapore"
            ? "59"
            : deliveryBySubitem[item.id] === "other"
              ? "21"
              : "",
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
  if (error || !generation?.quickbooks_estimate_id) throw new Error("QuickBooks quote record not found");
  if (!(await canEditClient(supabase, generation.client_id, userId))) {
    throw new Error("You must be assigned to this client to update its QuickBooks quotes");
  }
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", generation.client_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!client) throw new Error("Client not found");
  const { data: activeSubitems, error: subitemsError } = await supabase
    .from("subitems")
    .select("*")
    .eq("client_id", generation.client_id)
    .is("deleted_at", null);
  if (subitemsError) throw subitemsError;
  return { generation, client: { ...client, subitems: activeSubitems ?? [] } };
}

const currentPreview = (estimate: any, poField: QuickBooksPoField | null) => ({
  id: estimate.Id,
  syncToken: estimate.SyncToken,
  docNumber: estimate.DocNumber,
  customer: estimate.CustomerRef?.name ?? "",
  total: Number(estimate.TotalAmt ?? 0),
  paymentTerm:
    (estimate.CustomField ?? []).find(
      (field: any) => String(field.DefinitionId) === "2",
    )?.StringValue ?? "",
  email: estimate.BillEmail?.Address ?? "",
  billingAddress: estimate.BillAddr?.Line1 ?? "",
  expirationDate: estimate.ExpirationDate ?? "",
  poNumber: poNumberFromEstimate(estimate, poField),
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
      const eligibleStatusIds = await eligibleSubitemStatusIds();
      const result = await qboRequest(`/estimate/${generation.quickbooks_estimate_id}`, { method: "GET" });
      const poField = await quickBooksPoNumberField();
      const linkedInvoices = await linkedInvoicesForEstimate(result.Estimate);
      return NextResponse.json({
        generation,
        current: currentPreview(result.Estimate, poField),
        incoming: incomingPreview(client, eligibleStatusIds),
        isInvoiced: linkedInvoices.length > 0,
        invoiceDocNumbers: linkedInvoices.map((invoice) => invoice.DocNumber ?? invoice.Id).filter(Boolean),
      });
    }
    if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    if (!(await canEditClient(supabase, clientId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const [{ data: client, error: clientError }, { data: storedEstimates, error: estimatesError }] =
      await Promise.all([
        supabase
          .from("clients")
          .select("id, company")
          .eq("id", clientId)
          .maybeSingle(),
        supabase
          .from("estimate_generations")
          .select("id, quickbooks_customer_id, quickbooks_estimate_id, quickbooks_estimate_doc_number, created_at")
          .eq("client_id", clientId)
          .not("quickbooks_estimate_id", "is", null)
          .order("created_at", { ascending: false }),
      ]);
    if (clientError) throw clientError;
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    if (estimatesError) throw estimatesError;

    const estimates = [...(storedEstimates ?? [])];
    let quickBooksCustomerId = estimates.find((estimate) => estimate.quickbooks_customer_id)
      ?.quickbooks_customer_id;
    if (!quickBooksCustomerId && client.company?.trim()) {
      const customerResult = await qboQuery(
        `SELECT * FROM Customer WHERE DisplayName = '${esc(client.company.trim())}'`,
      );
      quickBooksCustomerId = customerResult?.QueryResponse?.Customer?.[0]?.Id;
    }
    if (quickBooksCustomerId) {
      const quickBooksResult = await qboQuery(
        `SELECT * FROM Estimate WHERE CustomerRef = '${esc(String(quickBooksCustomerId))}'`,
      );
      const quickBooksEstimates = quickBooksResult?.QueryResponse?.Estimate ?? [];
      const storedByQuickBooksId = new Map(
        estimates.map((estimate) => [String(estimate.quickbooks_estimate_id), estimate]),
      );
      const reconciledEstimates: typeof estimates = [];
      for (const quickBooksEstimate of quickBooksEstimates) {
        if (!quickBooksEstimate?.Id) continue;
        const existing = storedByQuickBooksId.get(String(quickBooksEstimate.Id));
        if (existing) {
          reconciledEstimates.push(existing);
          continue;
        }
        const { data: generation, error: generationError } = await supabase
          .from("estimate_generations")
          .insert({
            client_id: clientId,
            quickbooks_customer_id: String(quickBooksCustomerId),
            quickbooks_estimate_id: String(quickBooksEstimate.Id),
            quickbooks_estimate_doc_number: quickBooksEstimate.DocNumber ?? null,
            quote_total: numberValue(quickBooksEstimate.TotalAmt),
            quote_subtotal:
              numberValue(quickBooksEstimate.TotalAmt) -
              numberValue(quickBooksEstimate.TxnTaxDetail?.TotalTax),
          })
          .select("id, quickbooks_customer_id, quickbooks_estimate_id, quickbooks_estimate_doc_number, created_at")
          .single();
        if (generationError) throw generationError;
        if (generation) reconciledEstimates.push(generation);
      }
      // Estimates absent from this live customer query were deleted or made
      // unavailable in QuickBooks, so they are deliberately omitted.
      estimates.splice(0, estimates.length, ...reconciledEstimates);
    } else if (estimates.length) {
      // A legacy generation can be missing its customer ID. Validate those
      // individual estimate IDs instead of presenting stale choices.
      const validEstimates: typeof estimates = [];
      for (const estimate of estimates) {
        try {
          await qboRequest(`/estimate/${estimate.quickbooks_estimate_id}`, {
            method: "GET",
          });
          validEstimates.push(estimate);
        } catch (error) {
          if (!/"code":"610"/.test(error instanceof Error ? error.message : "")) {
            throw error;
          }
        }
      }
      estimates.splice(0, estimates.length, ...validEstimates);
    }
    estimates.sort(
      (first, second) =>
        new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
    );
    await refreshClientTrackingRollups(clientId).catch((rollupError) =>
      console.error("Could not refresh client Tracking rollups", rollupError),
    );
    return NextResponse.json({ estimates });
  } catch (error: any) {
    return NextResponse.json({ error: quickBooksErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      estimateGenerationId,
      paymentTerm: suppliedPaymentTerm,
      companyName: suppliedCompanyName,
      email: suppliedEmail,
      billingAddress: suppliedBillingAddress,
      expirationDate: suppliedExpirationDate,
      poNumber: suppliedPoNumber,
      deliveryBySubitem = {},
    } = await request.json() as {
      estimateGenerationId?: string;
      paymentTerm?: string;
      companyName?: string;
      email?: string;
      billingAddress?: string;
      expirationDate?: string;
      poNumber?: string;
      deliveryBySubitem?: Record<string, "singapore" | "other">;
    };
    if (!estimateGenerationId) return NextResponse.json({ error: "Missing quote selection" }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { generation, client } = await authorisedGeneration(supabase, estimateGenerationId, user.id);
    const currentResult = await qboRequest(`/estimate/${generation.quickbooks_estimate_id}`, { method: "GET" });
    const current = currentResult.Estimate;
    if (!current?.SyncToken) throw new Error("QuickBooks quote is missing its update token");
    const linkedInvoices = await linkedInvoicesForEstimate(current);
    if (linkedInvoices.length) {
      const invoiceNumbers = linkedInvoices
        .map((invoice) => invoice.DocNumber ?? invoice.Id)
        .filter(Boolean)
        .join(", ");
      throw new Error(
        `This QuickBooks quote already has an invoice (${invoiceNumbers}). It cannot be updated from the CRM.`,
      );
    }
    const preview = incomingPreview(
      client,
      await eligibleSubitemStatusIds(),
      deliveryBySubitem,
    );
    if (!preview.lines.length) throw new Error("No eligible subitems with Quoted, Shortlisted, or Awarded status");
    if (preview.lines.some((line: { taxCode: string }) => !line.taxCode)) {
      return NextResponse.json(
        { error: "Choose a delivery destination for every quote line." },
        { status: 400 },
      );
    }
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
    const salesperson = profile?.full_name?.trim() || profile?.email || user.email || "CRM user";
    const paymentTerm = String(suppliedPaymentTerm ?? "").trim().slice(0, 200);
    if (!paymentTerm || paymentTerm === "Others (specify)") {
      return NextResponse.json({ error: "Payment terms are required for the QuickBooks quote." }, { status: 400 });
    }
    const companyName = String(suppliedCompanyName ?? client.company ?? "")
      .trim()
      .slice(0, 200);
    if (!companyName) {
      return NextResponse.json({ error: "Company name is required for the QuickBooks quote." }, { status: 400 });
    }
    const email = String(suppliedEmail ?? client.email ?? "").trim().slice(0, 320);
    const billingAddress = String(suppliedBillingAddress ?? client.billing_address ?? "")
      .trim()
      .slice(0, 500);
    const poNumber = String(suppliedPoNumber ?? "").trim().slice(0, 200);
    const expirationDate = dateOnly(
      suppliedExpirationDate,
      current.ExpirationDate || addOneMonth(new Date(current.TxnDate || Date.now())),
    );
    const poField = await quickBooksPoNumberField();
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
    let customer = current.CustomerRef;
    if (String(current.CustomerRef?.name ?? "").trim() !== companyName) {
      const matches = await qboQuery(
        `SELECT * FROM Customer WHERE DisplayName = '${esc(companyName)}'`,
      );
      const existingCustomer = matches?.QueryResponse?.Customer?.[0];
      if (existingCustomer) {
        customer = { value: existingCustomer.Id, name: existingCustomer.DisplayName };
      } else {
        const customerResult = await qboRequest(
          `/customer/${encodeURIComponent(String(current.CustomerRef?.value ?? ""))}`,
          { method: "GET" },
        );
        const currentCustomer = customerResult?.Customer;
        if (!currentCustomer?.Id || currentCustomer.SyncToken == null) {
          throw new Error("QuickBooks customer could not be updated.");
        }
        const customerUpdate = await qboRequest("/customer", {
          method: "POST",
          body: JSON.stringify({
            Id: currentCustomer.Id,
            SyncToken: currentCustomer.SyncToken,
            sparse: true,
            DisplayName: companyName,
            CompanyName: companyName,
          }),
        });
        customer = {
          value: customerUpdate?.Customer?.Id ?? currentCustomer.Id,
          name: customerUpdate?.Customer?.DisplayName ?? companyName,
        };
      }
    }
    const updatedResult = await qboRequest("/estimate", {
      method: "POST",
      body: JSON.stringify({
        Id: current.Id,
        SyncToken: current.SyncToken,
        sparse: false,
        CustomerRef: customer,
        TxnDate: current.TxnDate,
        ExpirationDate: expirationDate,
        BillAddr: { Line1: billingAddress || companyName },
        ShipAddr: current.ShipAddr,
        ...(email ? { BillEmail: { Address: email } } : {}),
        CustomerMemo: current.CustomerMemo,
        PrivateNote: current.PrivateNote,
        // Do not carry the old transaction-level tax detail into the rebuilt
        // quote. It can contain a stale/invalid TaxRateRef (for example 47)
        // even when the line TaxCodeRefs are valid. QuickBooks recalculates
        // the transaction tax from the rebuilt lines.
        CurrencyRef: current.CurrencyRef,
        ExchangeRate: current.ExchangeRate,
        DepartmentRef: current.DepartmentRef,
        SalesTermRef: current.SalesTermRef,
        Line: lines,
        CustomField: customFields(
          current.CustomField,
          salesperson,
          paymentTermForQuickBooks(paymentTerm),
          poNumber,
          poField,
        ),
      }),
    });
    const updated = updatedResult.Estimate;
    const quotePdfResult = await archiveQuickBooksEstimatePdf({
      clientId: client.id,
      estimateId: String(updated?.Id ?? current.Id),
      docNumber: updated?.DocNumber ?? current.DocNumber,
      actorName: salesperson,
    })
      .then((quotePdf) => ({ quotePdf, quotePdfError: null }))
      .catch((pdfError) => {
        console.error("Could not archive QuickBooks quote PDF", pdfError);
        return {
          quotePdf: null,
          quotePdfError:
            "The quote was updated, but its PDF could not be saved to this client's Files.",
        };
      });
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
      title: "updated a QuickBooks quote",
      description: updated?.DocNumber ? `QuickBooks quote ${updated.DocNumber}` : "QuickBooks quote updated",
      meta: { kind: "quickbooks", estimateGenerationId, quickbooksEstimateId: current.Id },
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({
      success: true,
      estimateId: updated?.Id,
      docNumber: updated?.DocNumber ?? current.DocNumber,
      ...quotePdfResult,
    });
  } catch (error: any) {
    console.error("QuickBooks quote update failed", error);
    return NextResponse.json({ error: quickBooksErrorMessage(error) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { qboQuery, qboRequest } from "@/lib/quickbooks/api";
import { getSystemLabel } from "@/lib/system-labels";
import { canEditClient } from "@/lib/client-access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { refreshClientTrackingRollups } from "@/lib/quickbooks/tracking-rollups";
import { archiveQuickBooksEstimatePdf } from "@/lib/quickbooks/estimate-pdf";

const ELIGIBLE_STATUS_KEYS = [
  "subitem_status_quoted",
  "subitem_status_shortlisted",
  "subitem_status_awarded",
] as const;
const isFreightLine = (name: unknown) =>
  /\bfreight\b/i.test(String(name ?? ""));

function esc(value: string) {
  return value.replace(/'/g, "\\'");
}

function numberValue(value: unknown) {
  const parsed = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim(),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}
function unitPriceValue(value: unknown) {
  return Math.round((numberValue(value) + Number.EPSILON) * 1_000) / 1_000;
}

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

type QuickBooksCustomField = {
  DefinitionId?: unknown;
  Name?: unknown;
  Type?: unknown;
  StringValue?: unknown;
  BooleanValue?: unknown;
  CustomField?: QuickBooksCustomField[];
};

/**
 * QuickBooks' legacy Preferences response stores sales custom field names in
 * nested Name/Value settings rather than in Estimate CustomField objects.
 * Resolve the active PO Number slot from those settings. This company has PO
 * Number in Sales Custom 1, but this deliberately verifies it at runtime.
 */
async function quickBooksPoNumberField() {
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
  const nameField = fields.find((field) =>
    poFieldNameMatches(field.StringValue),
  );
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
  // Sales Custom 2 is a legacy QuickBooks field with a 31-character value
  // limit. Keep the meaning while using a value that can be stored there.
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

function estimateMetadataFields(values: {
  salesperson: string;
  paymentTerm: string;
  poNumber: string;
  poField: { definitionId: string; type: string } | null;
}) {
  // Verified from the existing Make scenario's QuickBooks response:
  // DefinitionId 2 is Payment Terms; DefinitionId 3 is the current legacy
  // salesperson slot. Name is intentionally omitted because QuickBooks uses
  // the definition ID to resolve a transaction custom field.
  if (values.poNumber && !values.poField) {
    throw new Error(
      'QuickBooks does not have an active sales-form custom field named "PO Number".',
    );
  }
  return [
    ...(values.paymentTerm.trim()
      ? [
          {
            DefinitionId: "2",
            Type: "StringType",
            StringValue: values.paymentTerm.trim(),
          },
        ]
      : []),
    {
      DefinitionId: "3",
      Type: "StringType",
      StringValue: values.salesperson,
    },
    ...(values.poNumber && values.poField
      ? [
          {
            DefinitionId: values.poField.definitionId,
            Type: values.poField.type,
            StringValue: values.poNumber,
          },
        ]
      : []),
  ];
}

async function getOrCreateCustomer(client: any) {
  const name = (client.company ?? "").trim();
  if (!name) throw new Error("Client name missing");

  const existing = await qboQuery(
    `SELECT * FROM Customer WHERE DisplayName = '${esc(client.company)}'`,
  );

  console.log("hi");

  const found = existing?.QueryResponse?.Customer?.[0];
  if (found) return found;

  const created = await qboRequest("/customer", {
    method: "POST",
    body: JSON.stringify({
      DisplayName: client.company || undefined,
      PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
      PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
      BillAddr: client.billing_address
        ? { Line1: client.billing_address }
        : undefined,
    }),
  });

  return created.Customer;
}

async function getOrCreateItem(subitem: any) {
  const name = (subitem.name ?? "").trim();
  if (!name) throw new Error("Subitem name missing");

  const existing = await qboQuery(
    `SELECT * FROM Item WHERE Name = '${esc(name)}'`,
  );

  const found = existing?.QueryResponse?.Item?.[0];
  if (found) return found;

  const created = await qboRequest("/item", {
    method: "POST",
    body: JSON.stringify({
      Name: name,
      Type: "NonInventory",
      IncomeAccountRef: {
        value: process.env.QUICKBOOKS_INCOME_ACCOUNT_ID!,
      },
      SalesTaxCodeRef: {
        value: "59",
      },
    }),
  });

  return created.Item;
}

export async function POST(req: NextRequest) {
  try {
    const {
      clientId,
      companyName: suppliedCompanyName,
      salesperson: suppliedSalesperson,
      paymentTerm: suppliedPaymentTerm,
      email: suppliedEmail,
      billingAddress: suppliedBillingAddress,
      expirationDate: suppliedExpirationDate,
      poNumber: suppliedPoNumber,
      deliveryBySubitem,
    } = (await req.json()) as {
      clientId?: string;
      companyName?: string;
      salesperson?: string;
      paymentTerm?: string;
      email?: string;
      billingAddress?: string;
      expirationDate?: string;
      poNumber?: string;
      deliveryBySubitem?: Record<string, "singapore" | "other">;
    };
    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await canEditClient(supabase, clientId, user.id))) {
      return NextResponse.json(
        {
          error:
            "You must be assigned to this client to create a QuickBooks quote.",
        },
        { status: 403 },
      );
    }

    const paymentTerm = String(suppliedPaymentTerm ?? "")
      .trim()
      .slice(0, 200);
    const companyName = String(suppliedCompanyName ?? "")
      .trim()
      .slice(0, 200);
    const salesperson = String(suppliedSalesperson ?? "")
      .trim()
      .slice(0, 200);
    const email = String(suppliedEmail ?? "").trim().slice(0, 320);
    const billingAddress = String(suppliedBillingAddress ?? "")
      .trim()
      .slice(0, 500);
    const poNumber = String(suppliedPoNumber ?? "").trim().slice(0, 200);
    const expirationDate = dateOnly(suppliedExpirationDate, addOneMonth(new Date()));
    if (!companyName) {
      return NextResponse.json(
        { error: "Company name is required for the QuickBooks quote." },
        { status: 400 },
      );
    }
    if (!paymentTerm || paymentTerm === "Others (specify)") {
      return NextResponse.json(
        { error: "Payment terms are required for the QuickBooks quote." },
        { status: 400 },
      );
    }
    if (!salesperson) {
      return NextResponse.json(
        { error: "Salesperson is required for the QuickBooks quote." },
        { status: 400 },
      );
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const actorName =
      profile?.full_name?.trim() || profile?.email || user.email || "CRM user";

    const { data: client, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .is("deleted_at", null)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { data: activeSubitems, error: subitemsError } = await supabase
      .from("subitems")
      .select("*")
      .eq("client_id", clientId)
      .is("deleted_at", null);
    if (subitemsError) throw subitemsError;

    const eligibleStatusIds = new Set(
      (
        await Promise.all(
          ELIGIBLE_STATUS_KEYS.map((key) =>
            getSystemLabel("subitem_status", key),
          ),
        )
      ).map((label) => label.id),
    );
    const subitems = (activeSubitems ?? [])
      .filter((s: any) => eligibleStatusIds.has(s.status_option_id))
      .sort(
        (first: any, second: any) =>
          Number(first.position ?? Number.MAX_SAFE_INTEGER) -
          Number(second.position ?? Number.MAX_SAFE_INTEGER),
      );

    if (!subitems.length) {
      return NextResponse.json(
        {
          error: "No eligible subitems with Quoted/Shortlisted/Awarded status",
        },
        { status: 400 },
      );
    }
    const invalidDeliverySubitem = subitems.find(
      (subitem: { id: string }) =>
        !isFreightLine((subitem as { name?: string }).name) &&
        !["singapore", "other"].includes(
          String(deliveryBySubitem?.[subitem.id] ?? ""),
        ),
    );
    if (invalidDeliverySubitem) {
      return NextResponse.json(
        { error: "Choose a delivery destination for every quote line." },
        { status: 400 },
      );
    }

    const customer = await getOrCreateCustomer({
      ...client,
      company: companyName,
    });

    const lines: Array<{
      LineNum: number;
      Amount: number;
      Description: string;
      DetailType: "SalesItemLineDetail";
      SalesItemLineDetail: {
        ItemRef: { value: string; name: string };
        Qty: number;
        UnitPrice: number;
        TaxCodeRef: { value: string };
      };
    }> = [];
    for (let i = 0; i < subitems.length; i += 1) {
      const subitem = subitems[i];
      const item = await getOrCreateItem(subitem);

      // `price` on the CRM board is the line total (Qty × U.P.), not the unit price.
      const qty = numberValue(subitem.qty) || 1;
      const unitPrice = unitPriceValue(
        numberValue(subitem.up) ||
          (qty > 0 ? numberValue(subitem.price) / qty : 0),
      );
      const amount = qty * unitPrice;
      const taxCodeValue =
        isFreightLine(subitem.name) ||
        deliveryBySubitem?.[subitem.id] === "other"
          ? "21"
          : "59";

      lines.push({
        LineNum: i + 1,
        Amount: amount,
        Description: subitem.description || subitem.name || "Unnamed item",
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: item.Id,
            name: item.Name,
          },
          Qty: qty,
          UnitPrice: unitPrice,
          TaxCodeRef: {
            value: taxCodeValue,
          },
        },
      });
    }

    const customFields = estimateMetadataFields({
      salesperson,
      paymentTerm: paymentTermForQuickBooks(paymentTerm),
      poNumber,
      poField: poNumber ? await quickBooksPoNumberField() : null,
    });
    const estimateRes = await qboRequest("/estimate", {
      method: "POST",
      body: JSON.stringify({
        CustomerRef: {
          value: customer.Id,
          name: customer.DisplayName,
        },
        TxnDate: new Date().toISOString().slice(0, 10),
        ExpirationDate: expirationDate,
        ...(email ? { BillEmail: { Address: email } } : {}),
        BillAddr: { Line1: billingAddress || companyName },
        Line: lines,
        ...(customFields.length ? { CustomField: customFields } : {}),
      }),
    });

    const estimate = estimateRes?.Estimate;

    const { data: generation, error: generationError } = await supabaseAdmin
      .from("estimate_generations")
      .insert({
        client_id: client.id,
        quickbooks_customer_id: customer.Id,
        quickbooks_estimate_id: estimate?.Id ?? null,
        quickbooks_estimate_doc_number: estimate?.DocNumber ?? null,
        quote_total: numberValue(estimate?.TotalAmt),
        quote_subtotal:
          numberValue(estimate?.TotalAmt) -
          numberValue(estimate?.TxnTaxDetail?.TotalTax),
      })
      .select("id")
      .single();
    if (generationError) throw generationError;

    // Preserve the exact set of subitems, prices, and delivery tax choices
    // that formed this quote. Later CRM edits must not rewrite historic quote
    // totals or make quote-to-invoice matching compare against new values.
    const { error: snapshotError } = await supabaseAdmin
      .from("estimate_generation_subitems")
      .insert(
        subitems.map((subitem: any, index: number) => {
          const quoteLine = lines[index];
          return {
            estimate_generation_id: generation.id,
            subitem_id: subitem.id,
            position: index,
            name: subitem.name ?? "Unnamed item",
            description: subitem.description ?? "",
            quantity: numberValue(quoteLine?.SalesItemLineDetail?.Qty),
            unit_price: numberValue(quoteLine?.SalesItemLineDetail?.UnitPrice),
            line_total: numberValue(quoteLine?.Amount),
            tax_code: quoteLine?.SalesItemLineDetail?.TaxCodeRef?.value ?? null,
            delivery_destination: deliveryBySubitem?.[subitem.id] ?? null,
          };
        }),
      );
    if (snapshotError) throw snapshotError;

    const quotePdfResult = await archiveQuickBooksEstimatePdf({
      clientId: client.id,
      estimateId: String(estimate?.Id ?? ""),
      docNumber: estimate?.DocNumber,
      actorName,
    })
      .then((quotePdf) => ({ quotePdf, quotePdfError: null }))
      .catch((pdfError) => {
        console.error("Could not archive QuickBooks quote PDF", pdfError);
        return {
          quotePdf: null,
          quotePdfError:
            "The quote was created, but its PDF could not be saved to this client's Files.",
        };
      });

    const { error: activityError } = await supabase
      .from("activity_log")
      .insert({
        client_id: client.id,
        subitem_id: null,
        actor_name: actorName,
        action: "estimate_created",
        field_name: null,
        old_value: null,
        new_value: null,
        subitem_name: null,
        link: null,
        title: "generated a QuickBooks quote",
        description: estimate?.DocNumber
          ? `QuickBooks quote ${estimate.DocNumber}`
          : "QuickBooks quote generated",
        meta: {
          kind: "quickbooks",
          estimateGenerationId: generation.id,
          quickbooksEstimateId: estimate?.Id ?? null,
          docNumber: estimate?.DocNumber ?? null,
          subitemIds: subitems.map((item: { id: string }) => item.id),
        },
        created_at: new Date().toISOString(),
      });
    if (activityError) throw activityError;

    await refreshClientTrackingRollups(client.id).catch((rollupError) =>
      console.error("Could not refresh client Tracking rollups", rollupError),
    );

    return NextResponse.json({
      success: true,
      estimateGenerationId: generation.id,
      estimateId: estimate?.Id ?? null,
      docNumber: estimate?.DocNumber ?? null,
      ...quotePdfResult,
    });
  } catch (error: any) {
    console.error("Generate quote failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to generate quote" },
      { status: 500 },
    );
  }
}

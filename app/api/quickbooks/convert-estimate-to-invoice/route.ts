import { NextRequest, NextResponse } from "next/server";
import { qboQuery, qboRequest } from "@/lib/quickbooks/api";
import { canEditClient } from "@/lib/client-access";
import { invoiceSnapshot, isMissingQuickBooksObject, type QuickBooksInvoiceRecord } from "@/lib/quickbooks/invoice-records";
import { refreshClientTrackingRollups } from "@/lib/quickbooks/tracking-rollups";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSystemLabel } from "@/lib/system-labels";

type QuickBooksEstimate = {
  Id?: string;
  DocNumber?: string;
  TxnStatus?: string;
  CustomerRef?: { value?: string; name?: string };
  BillEmail?: unknown;
  BillAddr?: unknown;
  ShipAddr?: unknown;
  SalesTermRef?: unknown;
  CustomField?: unknown;
  Line?: Array<{
    Id?: string | number | null;
    LineNum?: string | number | null;
    DetailType?: string | null;
    LinkedTxn?: unknown;
    [key: string]: unknown;
  }>;
};

class ConversionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
  }
}

function invoiceLinksToEstimate(
  invoice: QuickBooksInvoiceRecord,
  estimateId: string,
) {
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

function quickBooksErrorDetail(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) return raw || "QuickBooks did not provide a reason.";
  try {
    const payload = JSON.parse(raw.slice(jsonStart));
    const fault = payload?.Fault?.Error?.[0];
    return String(fault?.Detail ?? fault?.Message ?? raw);
  } catch {
    return raw;
  }
}

function invoiceLineFromEstimate(
  line: Record<string, unknown>,
  estimateId: string,
) {
  const { Id, LinkedTxn: _linkedTxn, ...invoiceLine } = line;
  const estimateLineId = String(Id ?? "").trim();
  if (!estimateLineId) {
    throw new ConversionError(
      "This QuickBooks quote has an invoiceable line without a source ID.",
      409,
      "The invoice was not created because QuickBooks cannot link that line back to the quote. Open the quote in QuickBooks and save it once, then try again.",
    );
  }
  // A Quote may also contain presentation-only subtotal/description lines.
  // This function is intentionally called only for source sales-item lines;
  // QuickBooks records the conversion using their actual Estimate line IDs.
  return {
    ...invoiceLine,
    LinkedTxn: [
      {
        TxnId: estimateId,
        TxnType: "Estimate",
        TxnLineId: estimateLineId,
      },
    ],
  };
}

async function updateTrackingAfterConversion(params: {
  estimateGenerationId: string;
  clientId: string;
  invoice: QuickBooksInvoiceRecord;
}) {
  const invoiceRow = {
    estimate_generation_id: params.estimateGenerationId,
    ...invoiceSnapshot(params.invoice),
    link_source: "quickbooks",
  };
  const { error: upsertError } = await supabaseAdmin
    .from("quickbooks_estimate_invoices")
    .upsert(invoiceRow, {
      onConflict: "estimate_generation_id,quickbooks_invoice_id",
    });
  if (upsertError) throw upsertError;

  const { data: invoices, error: invoicesError } = await supabaseAdmin
    .from("quickbooks_estimate_invoices")
    .select("total, subtotal, balance, is_voided")
    .eq("estimate_generation_id", params.estimateGenerationId);
  if (invoicesError) throw invoicesError;

  const activeInvoices = (invoices ?? []).filter((invoice) => !invoice.is_voided);
  const invoiceTotal = activeInvoices.reduce(
    (total, invoice) => total + Number(invoice.total ?? 0),
    0,
  );
  const invoiceSubtotal = activeInvoices.reduce(
    (total, invoice) => total + Number(invoice.subtotal ?? 0),
    0,
  );
  const totalBalance = activeInvoices.reduce(
    (total, invoice) => total + Number(invoice.balance ?? 0),
    0,
  );
  const invoicePaymentLabel =
    activeInvoices.length === 0
      ? null
      : Math.abs(totalBalance) < 0.005
        ? await getSystemLabel(
            "tracking_invoice_payment_status",
            "tracking_invoice_payment_status_paid",
          )
        : totalBalance < invoiceTotal
          ? await getSystemLabel(
              "tracking_invoice_payment_status",
              "tracking_invoice_payment_status_partially_paid",
            )
          : null;

  const { error: generationError } = await supabaseAdmin
    .from("estimate_generations")
    .update({
      invoice_count: (invoices ?? []).length,
      invoice_total: invoiceTotal,
      invoice_subtotal: invoiceSubtotal,
      total_balance: totalBalance,
      invoice_payment_status: invoicePaymentLabel?.value ?? null,
      invoice_payment_status_option_id: invoicePaymentLabel?.id ?? null,
      last_invoice_synced_at: new Date().toISOString(),
    })
    .eq("id", params.estimateGenerationId);
  if (generationError) throw generationError;

  await refreshClientTrackingRollups(params.clientId);
}

export async function POST(request: NextRequest) {
  try {
    const { estimateGenerationId } = (await request.json()) as {
      estimateGenerationId?: string;
    };
    if (!estimateGenerationId?.trim()) {
      throw new ConversionError("A QuickBooks quote is required.", 400);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ConversionError("Sign in to convert a quote to an invoice.", 401);

    const { data: generation, error: generationError } = await supabase
      .from("estimate_generations")
      .select("id, client_id, quickbooks_customer_id, quickbooks_estimate_id, quickbooks_estimate_doc_number")
      .eq("id", estimateGenerationId)
      .is("archived_at", null)
      .maybeSingle();
    if (generationError) throw generationError;
    if (!generation?.quickbooks_estimate_id) {
      throw new ConversionError("This linked quote no longer has a QuickBooks estimate ID.", 409);
    }
    if (!(await canEditClient(supabase, generation.client_id, user.id))) {
      throw new ConversionError(
        "You cannot convert this quote to an invoice.",
        403,
        "You must be assigned to this client, or have Admin, Director, or Dev access.",
      );
    }

    let estimate: QuickBooksEstimate;
    try {
      const result = await qboRequest(
        `/estimate/${encodeURIComponent(generation.quickbooks_estimate_id)}`,
        { method: "GET" },
      );
      estimate = result?.Estimate as QuickBooksEstimate;
      if (!estimate?.Id) {
        throw new Error("QuickBooks returned the quote without an estimate ID.");
      }
    } catch (error) {
      if (isMissingQuickBooksObject(error)) {
        throw new ConversionError(
          "This QuickBooks quote no longer exists.",
          404,
          "It may have been deleted or made inactive in QuickBooks.",
        );
      }
      throw new ConversionError(
        "QuickBooks could not load this quote.",
        502,
        quickBooksErrorDetail(error),
      );
    }

    const estimateId = String(estimate?.Id ?? generation.quickbooks_estimate_id);
    const quoteLabel = estimate.DocNumber ?? generation.quickbooks_estimate_doc_number ?? estimateId;
    const estimateStatus = String(estimate.TxnStatus ?? "").trim();
    if (estimateStatus.toLowerCase() !== "accepted") {
      throw new ConversionError(
        `QuickBooks quote ${quoteLabel} must be Accepted before it can be converted to an invoice.`,
        409,
        `Its current QuickBooks status is ${estimateStatus || "unknown"}. Open the quote in QuickBooks, mark it Accepted, then try again.`,
      );
    }
    const customerId = String(
      estimate.CustomerRef?.value ?? generation.quickbooks_customer_id ?? "",
    ).trim();
    if (!customerId) {
      throw new ConversionError(
        `QuickBooks quote ${quoteLabel} has no customer.`,
        409,
        "Add a customer to the quote in QuickBooks before converting it.",
      );
    }
    const invoiceableEstimateLines = (estimate.Line ?? []).filter(
      (line) => line.DetailType === "SalesItemLineDetail",
    );
    const lines = invoiceableEstimateLines.map((line) =>
      invoiceLineFromEstimate(line, estimateId),
    );
    const estimateLineReferences = invoiceableEstimateLines.map((line) =>
      String(line.Id ?? "").trim(),
    );
    if (!lines.length) {
      throw new ConversionError(
        `QuickBooks quote ${quoteLabel} has no invoiceable lines.`,
        409,
        "No new invoice was created.",
      );
    }

    const { data: storedInvoices, error: storedInvoicesError } =
      await supabaseAdmin
        .from("quickbooks_estimate_invoices")
        .select("quickbooks_invoice_doc_number")
        .eq("estimate_generation_id", generation.id);
    if (storedInvoicesError) throw storedInvoicesError;
    let customerInvoices: { QueryResponse?: { Invoice?: QuickBooksInvoiceRecord[] } };
    try {
      customerInvoices = await qboQuery(
        `SELECT * FROM Invoice WHERE CustomerRef = '${customerId.replace(/'/g, "\\'")}'`,
      );
    } catch (error) {
      throw new ConversionError(
        "QuickBooks could not check whether this quote already has an invoice.",
        502,
        quickBooksErrorDetail(error),
      );
    }
    const linkedInvoices = (
      customerInvoices?.QueryResponse?.Invoice ?? []
    ).filter((invoice: QuickBooksInvoiceRecord) =>
      invoiceLinksToEstimate(invoice, estimateId),
    ) as QuickBooksInvoiceRecord[];
    if (linkedInvoices.length || storedInvoices?.length) {
      const invoiceNumbers = [
        ...linkedInvoices.map((invoice) => invoice.DocNumber ?? invoice.Id),
        ...(storedInvoices ?? []).map(
          (invoice) => invoice.quickbooks_invoice_doc_number,
        ),
      ]
        .filter(Boolean)
        .join(", ");
      throw new ConversionError(
        `QuickBooks quote ${quoteLabel} already has a linked invoice.`,
        409,
        invoiceNumbers
          ? `Linked invoice: ${invoiceNumbers}. No duplicate invoice was created.`
          : "No duplicate invoice was created.",
      );
    }

    let invoice: QuickBooksInvoiceRecord;
    try {
      const result = await qboRequest("/invoice", {
        method: "POST",
        body: JSON.stringify({
          CustomerRef: estimate.CustomerRef,
          TxnDate: new Date().toISOString().slice(0, 10),
          ...(estimate.BillEmail ? { BillEmail: estimate.BillEmail } : {}),
          ...(estimate.BillAddr ? { BillAddr: estimate.BillAddr } : {}),
          ...(estimate.ShipAddr ? { ShipAddr: estimate.ShipAddr } : {}),
          ...(estimate.SalesTermRef ? { SalesTermRef: estimate.SalesTermRef } : {}),
          ...(estimate.CustomField ? { CustomField: estimate.CustomField } : {}),
          Line: lines,
          LinkedTxn: [{ TxnId: estimateId, TxnType: "Estimate" }],
        }),
      });
      invoice = result?.Invoice as QuickBooksInvoiceRecord;
      if (!invoice?.Id) {
        throw new Error("QuickBooks did not return an invoice ID.");
      }
    } catch (error) {
      throw new ConversionError(
        `QuickBooks could not create an invoice from quote ${quoteLabel}.`,
        502,
        quickBooksErrorDetail(error),
      );
    }

    const invoiceLabel = invoice.DocNumber ?? invoice.Id;
    let quickBooksLinkWarning: string | null = null;
    try {
      const readResult = await qboRequest(
        `/invoice/${encodeURIComponent(String(invoice.Id))}`,
        { method: "GET" },
      );
      let createdInvoice = readResult?.Invoice as QuickBooksInvoiceRecord;
      // The single-entity response can omit linked transactions in some QBO
      // companies. Confirm through the transaction query as well, which is the
      // same response shape used by the Tracking invoice synchronizer.
      if (!invoiceLinksToEstimate(createdInvoice, estimateId)) {
        const queryResult = await qboQuery(
          `SELECT * FROM Invoice WHERE Id = '${String(invoice.Id).replace(/'/g, "\\'")}'`,
        );
        const queriedInvoice = queryResult?.QueryResponse?.Invoice?.[0] as
          | QuickBooksInvoiceRecord
          | undefined;
        if (queriedInvoice) createdInvoice = queriedInvoice;
      }
      if (!invoiceLinksToEstimate(createdInvoice, estimateId)) {
        // Some QBO companies accept the Invoice create but do not persist the
        // transaction link until the Invoice is saved once more. Perform a
        // sparse update using the estimate and source-line references before
        // reporting that the link is genuinely unavailable.
        const syncToken = String(createdInvoice.SyncToken ?? invoice.SyncToken ?? "").trim();
        if (syncToken) {
          try {
            const linkedInvoiceLines = Array.isArray(createdInvoice.Line)
              ? createdInvoice.Line.map((line: Record<string, unknown>, index: number) => ({
                  ...line,
                  LinkedTxn: [
                    {
                      TxnId: estimateId,
                      TxnType: "Estimate",
                      TxnLineId:
                        estimateLineReferences[index] ?? String(index + 1),
                    },
                  ],
                }))
              : undefined;
            const repairResult = await qboRequest("/invoice", {
              method: "POST",
              body: JSON.stringify({
                sparse: true,
                Id: String(invoice.Id),
                SyncToken: syncToken,
                LinkedTxn: [{ TxnId: estimateId, TxnType: "Estimate" }],
                ...(linkedInvoiceLines ? { Line: linkedInvoiceLines } : {}),
              }),
            });
            const repairedInvoice = repairResult?.Invoice as
              | QuickBooksInvoiceRecord
              | undefined;
            if (repairedInvoice?.Id) createdInvoice = repairedInvoice;
          } catch (repairError) {
            quickBooksLinkWarning =
              `Invoice ${invoiceLabel} was created, but QuickBooks rejected the corrective quote link: ${quickBooksErrorDetail(repairError)}`;
          }
        }
        if (
          !quickBooksLinkWarning &&
          !invoiceLinksToEstimate(createdInvoice, estimateId)
        ) {
          quickBooksLinkWarning =
            `Invoice ${invoiceLabel} was created, but QuickBooks did not confirm its link to quote ${quoteLabel} after the corrective save.`;
        }
      } else {
        invoice = createdInvoice;
      }
      if (!quickBooksLinkWarning && invoiceLinksToEstimate(createdInvoice, estimateId)) {
        invoice = createdInvoice;
      }
    } catch (error) {
      quickBooksLinkWarning =
        `Invoice ${invoiceLabel} was created, but the QuickBooks quote link could not be verified: ${quickBooksErrorDetail(error)}`;
    }
    try {
      await updateTrackingAfterConversion({
        estimateGenerationId: generation.id,
        clientId: generation.client_id,
        invoice,
      });
    } catch (error) {
      console.error("QuickBooks invoice was created but Tracking sync failed", error);
      return NextResponse.json(
        {
          success: true,
          invoiceId: invoice.Id,
          invoiceNumber: invoice.DocNumber ?? null,
          trackingSynced: false,
          warning: `Invoice ${invoiceLabel} was created in QuickBooks, but could not yet be added to Tracking: ${quickBooksErrorDetail(error)}`,
        },
        { status: 207 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        invoiceId: invoice.Id,
        invoiceNumber: invoice.DocNumber ?? null,
        trackingSynced: true,
        quickBooksLinked: !quickBooksLinkWarning,
        ...(quickBooksLinkWarning ? { warning: quickBooksLinkWarning } : {}),
      },
      { status: quickBooksLinkWarning ? 207 : 201 },
    );
  } catch (error) {
    if (error instanceof ConversionError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail ?? null },
        { status: error.status },
      );
    }
    console.error("QuickBooks quote conversion failed", error);
    return NextResponse.json(
      {
        error: "Invoice could not be created.",
        detail: quickBooksErrorDetail(error),
      },
      { status: 500 },
    );
  }
}

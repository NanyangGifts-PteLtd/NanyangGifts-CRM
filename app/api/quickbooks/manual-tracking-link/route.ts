import { NextRequest, NextResponse } from "next/server";
import { qboQuery } from "@/lib/quickbooks/api";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canEditClient } from "@/lib/client-access";
import { getSystemLabel } from "@/lib/system-labels";
import { refreshClientTrackingRollups } from "@/lib/quickbooks/tracking-rollups";

type LinkKind = "quote" | "invoice";

type QboLink = { TxnId?: string; TxnType?: string };
type QboInvoice = {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number | string;
  Balance?: number | string;
  CustomerRef?: { value?: string; name?: string };
  TxnTaxDetail?: { TotalTax?: number | string };
  LinkedTxn?: QboLink[];
  Line?: QboLine[];
};

type QboLine = {
  DetailType?: string;
  Description?: string;
  Amount?: number | string;
  LinkedTxn?: QboLink[];
  SalesItemLineDetail?: {
    ItemRef?: { name?: string; value?: string };
    Qty?: number | string;
    UnitPrice?: number | string;
  };
};

const numberOrNull = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const escapeQueryValue = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

function invoiceEstimateIds(invoice: QboInvoice) {
  return [
    ...(invoice.LinkedTxn ?? []),
    ...(invoice.Line ?? []).flatMap((line) => line.LinkedTxn ?? []),
  ]
    .filter((link) => link.TxnType?.toLowerCase() === "estimate" && link.TxnId)
    .map((link) => String(link.TxnId));
}

async function authorize(clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (!(await canEditClient(supabase, clientId, user.id))) {
    throw new Error("Forbidden");
  }
  return { supabase, user };
}

function previewLines(lines: QboLine[] | undefined) {
  return (lines ?? [])
    .filter((line) => line.DetailType !== "SubTotalLine")
    .slice(0, 12)
    .map((line) => ({
      description:
        line.Description ?? line.SalesItemLineDetail?.ItemRef?.name ?? "Untitled line",
      item: line.SalesItemLineDetail?.ItemRef?.name ?? null,
      quantity: numberOrNull(line.SalesItemLineDetail?.Qty),
      unitPrice: numberOrNull(line.SalesItemLineDetail?.UnitPrice),
      amount: numberOrNull(line.Amount),
    }));
}

function previewTransaction(transaction: any, includeBalance: boolean) {
  const total = numberOrNull(transaction?.TotalAmt);
  const tax = numberOrNull(transaction?.TxnTaxDetail?.TotalTax) ?? 0;
  return {
    id: String(transaction?.Id ?? ""),
    number: String(transaction?.DocNumber ?? ""),
    customer: transaction?.CustomerRef?.name ?? null,
    customerEmail: transaction?.BillEmail?.Address ?? null,
    billingAddress: [
      transaction?.BillAddr?.Line1,
      transaction?.BillAddr?.Line2,
      transaction?.BillAddr?.City,
      transaction?.BillAddr?.CountrySubDivisionCode,
      transaction?.BillAddr?.PostalCode,
    ].filter(Boolean).join(", ") || null,
    date: transaction?.TxnDate ?? null,
    dueDate: transaction?.DueDate ?? null,
    status: transaction?.TxnStatus ?? transaction?.EmailStatus ?? null,
    terms: transaction?.SalesTermRef?.name ?? null,
    memo: transaction?.CustomerMemo?.value ?? transaction?.PrivateNote ?? null,
    tax,
    total,
    subtotal: total === null ? null : total - tax,
    balance: includeBalance ? numberOrNull(transaction?.Balance) : undefined,
    lines: previewLines(transaction?.Line),
    additionalLineCount: Math.max((transaction?.Line?.length ?? 0) - 12, 0),
  };
}

function previewQuote(quote: any) {
  return previewTransaction(quote, false);
}

function previewInvoice(invoice: QboInvoice) {
  return previewTransaction(invoice, true);
}

async function lookupQuote(number: string) {
  const { data: existing, error } = await supabaseAdmin
    .from("estimate_generations")
    .select("id")
    .eq("quickbooks_estimate_doc_number", number)
    .is("archived_at", null)
    .limit(1);
  if (error) throw error;
  if (existing?.length) throw new Error("This QuickBooks quote number is already linked to a client.");

  const result = await qboQuery(
    `SELECT * FROM Estimate WHERE DocNumber = '${escapeQueryValue(number)}'`,
  );
  const quotes = result?.QueryResponse?.Estimate ?? [];
  if (!quotes.length) throw new Error("No QuickBooks quote was found with that quote number.");
  const quote = quotes[0];
  if (!quote?.Id) throw new Error("QuickBooks returned a quote without an ID.");
  const { data: idMatch, error: idMatchError } = await supabaseAdmin
    .from("estimate_generations")
    .select("id")
    .eq("quickbooks_estimate_id", String(quote.Id))
    .is("archived_at", null)
    .limit(1);
  if (idMatchError) throw idMatchError;
  if (idMatch?.length) throw new Error("This QuickBooks quote is already linked to a client.");
  return quote;
}

async function lookupInvoice(number: string, generation: any) {
  const { data: existing, error } = await supabaseAdmin
    .from("quickbooks_estimate_invoices")
    .select("id")
    .eq("quickbooks_invoice_doc_number", number)
    .limit(1);
  if (error) throw error;
  if (existing?.length) throw new Error("This QuickBooks invoice number is already linked to a quote.");

  const result = await qboQuery(
    `SELECT * FROM Invoice WHERE DocNumber = '${escapeQueryValue(number)}'`,
  );
  const invoices = (result?.QueryResponse?.Invoice ?? []) as QboInvoice[];
  if (!invoices.length) throw new Error("No QuickBooks invoice was found with that invoice number.");
  const invoice = invoices[0];
  if (!invoice?.Id) throw new Error("QuickBooks returned an invoice without an ID.");
  const { data: idMatch, error: idMatchError } = await supabaseAdmin
    .from("quickbooks_estimate_invoices")
    .select("id")
    .eq("quickbooks_invoice_id", String(invoice.Id))
    .limit(1);
  if (idMatchError) throw idMatchError;
  if (idMatch?.length) throw new Error("This QuickBooks invoice is already linked to a quote.");

  const linkedEstimateIds = invoiceEstimateIds(invoice);
  if (linkedEstimateIds.some((id) => id !== String(generation.quickbooks_estimate_id))) {
    throw new Error("This invoice is already linked to a different QuickBooks quote.");
  }
  return invoice;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = body.kind as LinkKind;
    const phase = body.phase as "lookup" | "confirm";
    const number = String(body.number ?? "").trim();
    const clientId = String(body.clientId ?? "").trim();
    const estimateGenerationId = String(body.estimateGenerationId ?? "").trim();
    if (!(["quote", "invoice"] as string[]).includes(kind) || !(["lookup", "confirm"] as string[]).includes(phase) || !number || !clientId) {
      return NextResponse.json({ error: "A link type, number, and client are required." }, { status: 400 });
    }
    const { user } = await authorize(clientId);

    if (kind === "quote") {
      const quote = await lookupQuote(number);
      if (phase === "lookup") return NextResponse.json({ preview: previewQuote(quote) });

      // Re-check immediately before the write so two people cannot link the same quote.
      const { data: duplicate } = await supabaseAdmin
        .from("estimate_generations")
        .select("id")
        .eq("quickbooks_estimate_id", String(quote.Id))
        .is("archived_at", null)
        .limit(1);
      if (duplicate?.length) return NextResponse.json({ error: "This QuickBooks quote was just linked by another user." }, { status: 409 });
      const total = numberOrNull(quote.TotalAmt);
      const tax = numberOrNull(quote.TxnTaxDetail?.TotalTax) ?? 0;
      const { data: generation, error } = await supabaseAdmin
        .from("estimate_generations")
        .insert({
          client_id: clientId,
          quickbooks_customer_id: quote.CustomerRef?.value ?? null,
          quickbooks_estimate_id: String(quote.Id),
          quickbooks_estimate_doc_number: quote.DocNumber ?? number,
          title: quote.DocNumber ? `Quote ${quote.DocNumber}` : null,
          quote_total: total,
          quote_subtotal: total === null ? null : total - tax,
          link_source: "manual",
          manually_linked_at: new Date().toISOString(),
          manually_linked_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      await refreshClientTrackingRollups(clientId);
      return NextResponse.json({ linked: true, estimateGenerationId: generation.id });
    }

    if (!estimateGenerationId) {
      return NextResponse.json({ error: "Select a quote before linking an invoice." }, { status: 400 });
    }
    const { data: generation, error: generationError } = await supabaseAdmin
      .from("estimate_generations")
      .select("id, client_id, quickbooks_estimate_id, quote_total, quote_subtotal")
      .eq("id", estimateGenerationId)
      .eq("client_id", clientId)
      .is("archived_at", null)
      .maybeSingle();
    if (generationError) throw generationError;
    if (!generation?.quickbooks_estimate_id) throw new Error("The selected quote is unavailable.");

    const invoice = await lookupInvoice(number, generation);
    if (phase === "lookup") return NextResponse.json({ preview: previewInvoice(invoice) });

    const total = numberOrNull(invoice.TotalAmt);
    const tax = numberOrNull(invoice.TxnTaxDetail?.TotalTax) ?? 0;
    const subtotal = total === null ? null : total - tax;
    const { error: linkError } = await supabaseAdmin
      .from("quickbooks_estimate_invoices")
      .insert({
        estimate_generation_id: generation.id,
        quickbooks_invoice_id: String(invoice.Id),
        quickbooks_invoice_doc_number: invoice.DocNumber ?? number,
        invoice_date: invoice.TxnDate ?? null,
        due_date: invoice.DueDate ?? null,
        subtotal,
        tax_total: numberOrNull(invoice.TxnTaxDetail?.TotalTax),
        total,
        balance: numberOrNull(invoice.Balance),
        raw_payload: invoice,
        link_source: "manual",
        manually_linked_at: new Date().toISOString(),
        manually_linked_by: user.id,
        last_synced_at: new Date().toISOString(),
      });
    if (linkError) throw linkError;

    const { data: allInvoices, error: allInvoicesError } = await supabaseAdmin
      .from("quickbooks_estimate_invoices")
      .select("total, subtotal, balance")
      .eq("estimate_generation_id", generation.id);
    if (allInvoicesError) throw allInvoicesError;
    const invoices = allInvoices ?? [];
    const invoiceTotal = invoices.reduce((sum, row) => sum + (numberOrNull(row.total) ?? 0), 0);
    const invoiceSubtotal = invoices.reduce((sum, row) => sum + (numberOrNull(row.subtotal) ?? 0), 0);
    const totalBalance = invoices.reduce((sum, row) => sum + (numberOrNull(row.balance) ?? 0), 0);
    const match = generation.quote_subtotal != null && Math.abs(Number(generation.quote_subtotal) - invoiceSubtotal) < 0.005
      ? await getSystemLabel("tracking_price_invoice_match", "tracking_price_invoice_match_yes")
      : await getSystemLabel("tracking_price_invoice_match", "tracking_price_invoice_match_mismatch");
    const payment = Math.abs(totalBalance) < 0.005
      ? await getSystemLabel("tracking_invoice_payment_status", "tracking_invoice_payment_status_paid")
      : totalBalance < invoiceTotal
        ? await getSystemLabel("tracking_invoice_payment_status", "tracking_invoice_payment_status_partially_paid")
        : null;
    const { error: updateError } = await supabaseAdmin.from("estimate_generations").update({
      invoice_count: invoices.length,
      invoice_total: invoiceTotal,
      invoice_subtotal: invoiceSubtotal,
      total_balance: totalBalance,
      price_invoice_match: match?.value ?? "",
      price_invoice_match_option_id: match?.id ?? null,
      ...(payment ? { invoice_payment_status: payment.value, invoice_payment_status_option_id: payment.id } : {}),
      last_invoice_synced_at: new Date().toISOString(),
    }).eq("id", generation.id);
    if (updateError) throw updateError;
    await refreshClientTrackingRollups(clientId);
    return NextResponse.json({ linked: true, estimateGenerationId: generation.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not link the QuickBooks record.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = body.kind as LinkKind;
    const clientId = String(body.clientId ?? "").trim();
    const estimateGenerationId = String(body.estimateGenerationId ?? "").trim();
    const invoiceId = String(body.invoiceId ?? "").trim();

    if (!(["quote", "invoice"] as string[]).includes(kind) || !clientId) {
      return NextResponse.json({ error: "A link type and client are required." }, { status: 400 });
    }
    await authorize(clientId);

    if (kind === "quote") {
      if (!estimateGenerationId) {
        return NextResponse.json({ error: "Select a quote to unlink." }, { status: 400 });
      }
      const { data: quote, error: quoteError } = await supabaseAdmin
        .from("estimate_generations")
        .select("id, link_source")
        .eq("id", estimateGenerationId)
        .eq("client_id", clientId)
        .is("archived_at", null)
        .maybeSingle();
      if (quoteError) throw quoteError;
      if (!quote || quote.link_source !== "manual") {
        return NextResponse.json({ error: "Only manually linked quotes can be unlinked." }, { status: 400 });
      }

      const { error: invoiceDeleteError } = await supabaseAdmin
        .from("quickbooks_estimate_invoices")
        .delete()
        .eq("estimate_generation_id", quote.id);
      if (invoiceDeleteError) throw invoiceDeleteError;

      const { error: archiveError } = await supabaseAdmin
        .from("estimate_generations")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", quote.id);
      if (archiveError) throw archiveError;
      await refreshClientTrackingRollups(clientId);
      return NextResponse.json({ unlinked: true });
    }

    if (!estimateGenerationId || !invoiceId) {
      return NextResponse.json({ error: "Select an invoice to unlink." }, { status: 400 });
    }
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("quickbooks_estimate_invoices")
      .select("id, link_source, estimate_generations!inner(client_id)")
      .eq("id", invoiceId)
      .eq("estimate_generation_id", estimateGenerationId)
      .maybeSingle();
    if (invoiceError) throw invoiceError;
    const quoteClientId = (invoice?.estimate_generations as { client_id?: string } | null)
      ?.client_id;
    if (!invoice || quoteClientId !== clientId || invoice.link_source !== "manual") {
      return NextResponse.json({ error: "Only manually linked invoices can be unlinked." }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("quickbooks_estimate_invoices")
      .delete()
      .eq("id", invoice.id)
      .eq("estimate_generation_id", estimateGenerationId)
      .eq("link_source", "manual");
    if (deleteError) throw deleteError;

    const { data: remainingInvoices, error: remainingInvoicesError } = await supabaseAdmin
      .from("quickbooks_estimate_invoices")
      .select("total, subtotal, balance")
      .eq("estimate_generation_id", estimateGenerationId);
    if (remainingInvoicesError) throw remainingInvoicesError;
    const remaining = remainingInvoices ?? [];
    const invoiceTotal = remaining.reduce((sum, row) => sum + (numberOrNull(row.total) ?? 0), 0);
    const invoiceSubtotal = remaining.reduce((sum, row) => sum + (numberOrNull(row.subtotal) ?? 0), 0);
    const totalBalance = remaining.reduce((sum, row) => sum + (numberOrNull(row.balance) ?? 0), 0);
    const { data: generation, error: generationError } = await supabaseAdmin
      .from("estimate_generations")
      .select("quote_subtotal")
      .eq("id", estimateGenerationId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (generationError) throw generationError;
    const match = !remaining.length
      ? null
      : generation?.quote_subtotal != null &&
          Math.abs(Number(generation.quote_subtotal) - invoiceSubtotal) < 0.005
        ? await getSystemLabel("tracking_price_invoice_match", "tracking_price_invoice_match_yes")
        : await getSystemLabel("tracking_price_invoice_match", "tracking_price_invoice_match_mismatch");
    const payment = !remaining.length
      ? null
      : Math.abs(totalBalance) < 0.005
        ? await getSystemLabel("tracking_invoice_payment_status", "tracking_invoice_payment_status_paid")
        : totalBalance < invoiceTotal
          ? await getSystemLabel("tracking_invoice_payment_status", "tracking_invoice_payment_status_partially_paid")
          : null;
    const { error: totalsError } = await supabaseAdmin
      .from("estimate_generations")
      .update({
        invoice_count: remaining.length,
        invoice_total: invoiceTotal,
        invoice_subtotal: invoiceSubtotal,
        total_balance: totalBalance,
        price_invoice_match: match?.value ?? "",
        price_invoice_match_option_id: match?.id ?? null,
        invoice_payment_status: payment?.value ?? "",
        invoice_payment_status_option_id: payment?.id ?? null,
        last_invoice_synced_at: new Date().toISOString(),
      })
      .eq("id", estimateGenerationId)
      .eq("client_id", clientId);
    if (totalsError) throw totalsError;
    await refreshClientTrackingRollups(clientId);
    return NextResponse.json({ unlinked: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not unlink the QuickBooks record.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

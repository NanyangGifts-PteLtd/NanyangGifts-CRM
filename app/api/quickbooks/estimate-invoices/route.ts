import { NextRequest, NextResponse } from "next/server";
import { qboQuery, qboRequest } from "@/lib/quickbooks/api";
import { createClient } from "@/lib/supabase/server";

type QuickBooksLink = {
  TxnId?: string;
  TxnType?: string;
};

type QuickBooksInvoice = {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number | string;
  Balance?: number | string;
  TxnTaxDetail?: { TotalTax?: number | string };
  LinkedTxn?: QuickBooksLink[];
  Line?: Array<{
    LinkedTxn?: QuickBooksLink[];
  }>;
};

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function invoiceLinksToEstimate(
  invoice: QuickBooksInvoice,
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

function isMissingQuickBooksObject(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  try {
    const payload = JSON.parse(message.slice(message.indexOf("{")));
    return String(payload?.Fault?.Error?.[0]?.code) === "610";
  } catch {
    return false;
  }
}

async function authorizeInvoiceAccess(
  estimateGenerationId: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: generation, error: generationError } = await supabase
    .from("estimate_generations")
    .select("id, client_id, quickbooks_customer_id, quickbooks_estimate_id")
    .eq("id", estimateGenerationId)
    .maybeSingle();
  if (generationError) throw generationError;
  if (!generation?.quickbooks_estimate_id) throw new Error("QuickBooks estimate record not found");

  const [{ data: profile, error: profileError }, { data: assignments, error: assignmentError }] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase
        .from("client_assignees")
        .select("user_id")
        .eq("client_id", generation.client_id)
        .eq("user_id", user.id),
    ]);
  if (profileError || assignmentError) throw profileError ?? assignmentError;
  const role = String(profile?.role ?? "").toLowerCase();
  if (!["sales", "pm", "admin", "director", "dev"].includes(role)) {
    throw new Error("Forbidden");
  }
  if (!["admin", "director", "dev"].includes(role) && !assignments?.length) {
    throw new Error("You must be assigned to this client to view its invoices.");
  }
  return { supabase, generation };
}

export async function GET(request: NextRequest) {
  try {
    const estimateGenerationId = request.nextUrl.searchParams.get(
      "estimateGenerationId",
    );
    if (!estimateGenerationId) {
      return NextResponse.json(
        { error: "Missing estimateGenerationId" },
        { status: 400 },
      );
    }
    const { supabase, generation } = await authorizeInvoiceAccess(
      estimateGenerationId,
    );
    const { data: invoices, error } = await supabase
      .from("quickbooks_estimate_invoices")
      .select(
        "id, quickbooks_invoice_doc_number, invoice_date, due_date, subtotal",
      )
      .eq("estimate_generation_id", generation.id)
      .order("invoice_date", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ invoices: invoices ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load invoices.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { estimateGenerationId } = await request.json();
    if (!estimateGenerationId) {
      return NextResponse.json(
        { error: "Missing estimateGenerationId" },
        { status: 400 },
      );
    }

    const { supabase, generation } = await authorizeInvoiceAccess(
      estimateGenerationId,
    );

    let estimate: any;
    try {
      const result = await qboRequest(
        `/estimate/${generation.quickbooks_estimate_id}`,
        { method: "GET" },
      );
      estimate = result.Estimate;
    } catch (error) {
      if (isMissingQuickBooksObject(error)) {
        return NextResponse.json(
          {
            estimateMissing: true,
            error:
              "The selected QuickBooks estimate no longer exists. Choose another estimate.",
          },
          { status: 404 },
        );
      }
      throw error;
    }
    const customerId = estimate?.CustomerRef?.value ?? generation.quickbooks_customer_id;
    if (!customerId) {
      return NextResponse.json(
        { error: "This estimate does not have a QuickBooks customer to sync." },
        { status: 400 },
      );
    }
    const escapedCustomerId = String(customerId).replace(
      /'/g,
      "\\'",
    );
    const response = await qboQuery(
      `SELECT * FROM Invoice WHERE CustomerRef = '${escapedCustomerId}'`,
    );
    const invoices = (response?.QueryResponse?.Invoice ?? []) as QuickBooksInvoice[];
    const linkedInvoices = invoices.filter((invoice) =>
      invoiceLinksToEstimate(invoice, generation.quickbooks_estimate_id),
    );

    const rows = linkedInvoices
      .filter((invoice) => invoice.Id)
      .map((invoice) => {
        const total = numberOrNull(invoice.TotalAmt);
        const taxTotal = numberOrNull(invoice.TxnTaxDetail?.TotalTax) ?? 0;

        return {
          estimate_generation_id: generation.id,
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
      });

    const { data: storedInvoices, error: storedInvoicesError } = await supabase
      .from("quickbooks_estimate_invoices")
      .select("quickbooks_invoice_id")
      .eq("estimate_generation_id", generation.id);
    if (storedInvoicesError) throw storedInvoicesError;
    const linkedInvoiceIds = new Set(
      rows.map((row) => row.quickbooks_invoice_id),
    );
    const staleInvoiceIds = (storedInvoices ?? [])
      .map((invoice) => invoice.quickbooks_invoice_id)
      .filter((invoiceId) => !linkedInvoiceIds.has(invoiceId));
    if (staleInvoiceIds.length) {
      const { error: staleDeleteError } = await supabase
        .from("quickbooks_estimate_invoices")
        .delete()
        .eq("estimate_generation_id", generation.id)
        .in("quickbooks_invoice_id", staleInvoiceIds);
      if (staleDeleteError) throw staleDeleteError;
    }

    if (rows.length) {
      const { error: upsertError } = await supabase
        .from("quickbooks_estimate_invoices")
        .upsert(rows, {
          onConflict: "estimate_generation_id,quickbooks_invoice_id",
        });
      if (upsertError) throw upsertError;
    }

    return NextResponse.json({
      estimateGenerationId: generation.id,
      linkedInvoiceCount: rows.length,
      invoiceNumbers: rows
        .map((row) => row.quickbooks_invoice_doc_number ?? row.quickbooks_invoice_id)
        .filter(Boolean),
      invoices: rows.map((row) => ({
        id: row.quickbooks_invoice_id,
        quickbooks_invoice_doc_number: row.quickbooks_invoice_doc_number,
        invoice_date: row.invoice_date,
        due_date: row.due_date,
        subtotal: row.subtotal,
      })),
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("QuickBooks estimate invoice sync failed:", error);
    return NextResponse.json(
      { error: "Could not synchronize linked QuickBooks invoices." },
      { status: 500 },
    );
  }
}

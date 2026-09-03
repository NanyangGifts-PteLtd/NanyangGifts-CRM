import { NextRequest, NextResponse } from "next/server";
import { qboQuery } from "@/lib/quickbooks/api";
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

export async function POST(request: NextRequest) {
  try {
    const { estimateGenerationId } = await request.json();
    if (!estimateGenerationId) {
      return NextResponse.json(
        { error: "Missing estimateGenerationId" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: generation, error: generationError } = await supabase
      .from("estimate_generations")
      .select("id, client_id, quickbooks_customer_id, quickbooks_estimate_id")
      .eq("id", estimateGenerationId)
      .maybeSingle();

    if (generationError) throw generationError;
    if (!generation?.quickbooks_estimate_id || !generation.quickbooks_customer_id) {
      return NextResponse.json(
        { error: "This estimate does not have QuickBooks identifiers to sync." },
        { status: 400 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = String(profile?.role ?? "").toLowerCase();
    const isInternal = ["sales", "pm", "admin", "director", "dev"].includes(
      role,
    );
    if (!isInternal) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: assignments, error: assignmentError } = await supabase
      .from("client_assignees")
      .select("user_id")
      .eq("client_id", generation.client_id)
      .eq("user_id", user.id);
    if (assignmentError) throw assignmentError;
    if (!assignments?.length) {
      return NextResponse.json(
        { error: "You must be assigned to this client to sync its invoices." },
        { status: 403 },
      );
    }

    const escapedCustomerId = String(generation.quickbooks_customer_id).replace(
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

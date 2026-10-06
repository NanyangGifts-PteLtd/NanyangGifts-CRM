import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get("clientId")?.trim();
    if (!clientId)
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: generations, error: generationsError } = await supabase
      .from("estimate_generations")
      .select(
        "id, title, quickbooks_estimate_doc_number, created_at, quote_total, quote_subtotal, invoice_total, invoice_subtotal, invoice_count, total_balance, price_invoice_match, price_invoice_match_option_id, payment_status, invoice_payment_status, invoice_payment_status_option_id, tracking_summary, tracking_remarks, last_invoice_synced_at",
      )
      .eq("client_id", clientId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (generationsError) throw generationsError;

    const quoteIds = (generations ?? []).map((quote) => quote.id);
    const { data: invoices, error: invoicesError } = quoteIds.length
      ? await supabase
          .from("quickbooks_estimate_invoices")
          .select(
            "id, estimate_generation_id, quickbooks_invoice_doc_number, invoice_date, due_date, subtotal, total, balance",
          )
          .in("estimate_generation_id", quoteIds)
          .order("invoice_date", { ascending: false })
      : { data: [], error: null };
    if (invoicesError) throw invoicesError;

    const invoicesByQuote = new Map<string, typeof invoices>();
    for (const invoice of invoices ?? []) {
      const rows = invoicesByQuote.get(invoice.estimate_generation_id) ?? [];
      rows.push(invoice);
      invoicesByQuote.set(invoice.estimate_generation_id, rows);
    }

    return NextResponse.json({
      quotes: (generations ?? []).map((quote) => ({
        ...quote,
        invoices: invoicesByQuote.get(quote.id) ?? [],
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load this client's quotes",
      },
      { status: 500 },
    );
  }
}

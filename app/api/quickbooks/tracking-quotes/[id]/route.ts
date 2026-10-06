import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canEditClient } from "@/lib/client-access";
import { refreshClientTrackingRollups } from "@/lib/quickbooks/tracking-rollups";

const text = (value: unknown, maxLength = 200) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const quoteId = id.trim();
    if (!quoteId)
      return NextResponse.json({ error: "Missing quote id" }, { status: 400 });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: quote, error: quoteError } = await supabase
      .from("estimate_generations")
      .select("id, client_id")
      .eq("id", quoteId)
      .maybeSingle();
    if (quoteError) throw quoteError;
    if (!quote)
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (!(await canEditClient(supabase, quote.client_id, user.id)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, string | null> = {};
    if ("title" in body) updates.title = text(body.title);
    if ("trackingSummary" in body)
      updates.tracking_summary = text(body.trackingSummary);
    if ("paymentStatus" in body)
      updates.payment_status = text(body.paymentStatus);
    if ("trackingRemarks" in body)
      updates.tracking_remarks = text(body.trackingRemarks, 5000);
    if ("invoicePaymentStatus" in body) {
      updates.invoice_payment_status = text(body.invoicePaymentStatus);
      updates.invoice_payment_status_option_id =
        typeof body.invoicePaymentStatusOptionId === "string" &&
        body.invoicePaymentStatusOptionId.trim()
          ? body.invoicePaymentStatusOptionId.trim()
          : null;
    }
    if (!Object.keys(updates).length)
      return NextResponse.json({ error: "No quote fields supplied" }, { status: 400 });

    const { data: updatedQuote, error: updateError } = await supabaseAdmin
      .from("estimate_generations")
      .update(updates)
      .eq("id", quoteId)
      .select(
        "id, title, tracking_summary, tracking_remarks, payment_status, invoice_payment_status, invoice_payment_status_option_id, quickbooks_estimate_doc_number, created_at, quote_total, quote_subtotal, invoice_total, invoice_subtotal, invoice_count, total_balance, last_invoice_synced_at",
      )
      .single();
    if (updateError) throw updateError;
    if (
      "invoicePaymentStatus" in body
    )
      await refreshClientTrackingRollups(quote.client_id);
    return NextResponse.json({ quote: updatedQuote });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update quote",
      },
      { status: 500 },
    );
  }
}

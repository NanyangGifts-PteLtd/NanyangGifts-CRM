import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canEditClient } from "@/lib/client-access";
import { qboRequest } from "@/lib/quickbooks/api";
import {
  invoiceSnapshot,
  isMissingQuickBooksObject,
  type QuickBooksInvoiceRecord,
} from "@/lib/quickbooks/invoice-records";
import { refreshClientTrackingRollups } from "@/lib/quickbooks/tracking-rollups";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const clientId = String(body.clientId ?? "").trim();
    const invoiceId = String(body.invoiceId ?? "").trim();
    if (!clientId || !invoiceId)
      return NextResponse.json(
        { error: "A client and direct invoice are required." },
        { status: 400 },
      );

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await canEditClient(supabase, clientId, user.id)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: stored, error: storedError } = await supabaseAdmin
      .from("quickbooks_client_invoices")
      .select("id, quickbooks_invoice_id")
      .eq("id", invoiceId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (storedError) throw storedError;
    if (!stored)
      return NextResponse.json(
        { error: "This direct invoice is no longer linked." },
        { status: 404 },
      );

    try {
      const result = await qboRequest(
        `/invoice/${encodeURIComponent(stored.quickbooks_invoice_id)}`,
        { method: "GET" },
      );
      const invoice = result?.Invoice as QuickBooksInvoiceRecord | undefined;
      if (!invoice?.Id) throw new Error("QuickBooks returned an invalid invoice.");
      const { error: updateError } = await supabaseAdmin
        .from("quickbooks_client_invoices")
        .update(invoiceSnapshot(invoice))
        .eq("id", stored.id)
        .eq("client_id", clientId);
      if (updateError) throw updateError;
      await refreshClientTrackingRollups(clientId);
      return NextResponse.json({ synced: true });
    } catch (error) {
      if (!isMissingQuickBooksObject(error)) throw error;
      const { error: deleteError } = await supabaseAdmin
        .from("quickbooks_client_invoices")
        .delete()
        .eq("id", stored.id)
        .eq("client_id", clientId);
      if (deleteError) throw deleteError;
      await refreshClientTrackingRollups(clientId);
      return NextResponse.json({ removed: true });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not synchronize the direct invoice.",
      },
      { status: 500 },
    );
  }
}

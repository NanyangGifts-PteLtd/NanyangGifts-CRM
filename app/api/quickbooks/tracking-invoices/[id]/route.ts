import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canEditClient } from "@/lib/client-access";
import { refreshClientTrackingRollups } from "@/lib/quickbooks/tracking-rollups";

type InvoiceSource = "estimate" | "direct";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const invoiceId = id.trim();
    const body = (await request.json()) as Record<string, unknown>;
    const source: InvoiceSource = body.source === "direct" ? "direct" : "estimate";
    const optionId =
      typeof body.trackingStatusOptionId === "string" &&
      body.trackingStatusOptionId.trim()
        ? body.trackingStatusOptionId.trim()
        : null;
    if (!invoiceId)
      return NextResponse.json({ error: "Missing invoice id" }, { status: 400 });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const table =
      source === "direct"
        ? "quickbooks_client_invoices"
        : "quickbooks_estimate_invoices";
    let clientId: string | null = null;
    if (source === "direct") {
      const { data: invoice, error } = await supabaseAdmin
        .from(table)
        .select("id, client_id")
        .eq("id", invoiceId)
        .maybeSingle();
      if (error) throw error;
      clientId = invoice?.client_id ?? null;
    } else {
      const { data: invoice, error } = await supabaseAdmin
        .from(table)
        .select("id, estimate_generations!inner(client_id)")
        .eq("id", invoiceId)
        .maybeSingle();
      if (error) throw error;
      const generation = invoice?.estimate_generations as
        | { client_id?: string | null }
        | Array<{ client_id?: string | null }>
        | null;
      clientId = Array.isArray(generation)
        ? (generation[0]?.client_id ?? null)
        : (generation?.client_id ?? null);
    }
    if (!clientId)
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (!(await canEditClient(supabase, clientId, user.id)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let trackingStatus: string | null = null;
    if (optionId) {
      const { data: option, error } = await supabaseAdmin
        .from("option_values")
        .select("id, value, option_groups!inner(code)")
        .eq("id", optionId)
        .eq("option_groups.code", "tracking_payment_status")
        .maybeSingle();
      if (error) throw error;
      if (!option)
        return NextResponse.json(
          { error: "Tracking status label not found" },
          { status: 400 },
        );
      trackingStatus = option.value;
    }

    const { data: invoice, error: updateError } = await supabaseAdmin
      .from(table)
      .update({
        tracking_status: trackingStatus,
        tracking_status_option_id: optionId,
      })
      .eq("id", invoiceId)
      .select("id, tracking_status, tracking_status_option_id")
      .single();
    if (updateError) throw updateError;
    const trackingStatusSummary = await refreshClientTrackingRollups(clientId);
    return NextResponse.json({ invoice, trackingStatusSummary });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update invoice tracking status",
      },
      { status: 500 },
    );
  }
}

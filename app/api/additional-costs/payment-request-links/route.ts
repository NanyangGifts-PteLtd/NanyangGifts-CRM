import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);

export async function GET(request: NextRequest) {
  try {
    const ids = Array.from(
      new Set(
        (request.nextUrl.searchParams.get("paymentRowIds") ?? "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ).slice(0, 200);
    if (!ids.length) return NextResponse.json({ links: [] });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = String(profile?.role ?? "").toLowerCase();
    if (!INTERNAL_ROLES.has(role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: paymentRows, error: paymentRowsError } = await supabaseAdmin
      .from("subitem_payment_rows")
      .select("id, subitem_id")
      .in("id", ids);
    if (paymentRowsError) throw paymentRowsError;
    const subitemIds = (paymentRows ?? []).map((row) => row.subitem_id);
    const { data: subitems, error: subitemsError } = subitemIds.length
      ? await supabaseAdmin
          .from("subitems")
          .select("id, client_id")
          .in("id", subitemIds)
          .is("deleted_at", null)
      : { data: [], error: null };
    if (subitemsError) throw subitemsError;
    const clientIdBySubitemId = new Map(
      (subitems ?? []).map((subitem) => [subitem.id, subitem.client_id]),
    );
    const clientIds = Array.from(
      new Set(
        (paymentRows ?? [])
          .map((row) => clientIdBySubitemId.get(row.subitem_id))
          .filter((id): id is string => Boolean(id)),
      ),
    );
    let allowedClientIds = new Set(clientIds);
    if (!["admin", "director", "dev"].includes(role)) {
      const { data: assignments, error: assignmentsError } = await supabaseAdmin
        .from("client_assignees")
        .select("client_id")
        .eq("user_id", user.id)
        .in("assignment_type", ["people", "pm"])
        .in("client_id", clientIds);
      if (assignmentsError) throw assignmentsError;
      allowedClientIds = new Set((assignments ?? []).map((row) => row.client_id));
    }
    const visibleRowIds = (paymentRows ?? [])
      .filter((row) => allowedClientIds.has(clientIdBySubitemId.get(row.subitem_id) ?? ""))
      .map((row) => row.id);
    const { data: vouchers, error: vouchersError } = visibleRowIds.length
      ? await supabaseAdmin
          .from("additional_costs")
          .select("id, trip_id, is_draft, payment_request_payment_row_id")
          .eq("voucher_group", "payment_requests")
          .is("deactivated_at", null)
          .is("deleted_at", null)
          .in("payment_request_payment_row_id", visibleRowIds)
      : { data: [], error: null };
    if (vouchersError) throw vouchersError;
    return NextResponse.json({
      links: (vouchers ?? []).map((voucher) => ({
        paymentRowId: voucher.payment_request_payment_row_id,
        voucherId: voucher.id,
        referenceId: voucher.trip_id,
        isDraft: Boolean(voucher.is_draft),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load Payment Requests." },
      { status: 400 },
    );
  }
}

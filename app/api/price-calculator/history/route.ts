import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const roles = new Set(["sales", "pm", "admin", "director", "dev"]);

async function isAllowed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return roles.has(String(data?.role ?? "").toLowerCase());
}

export async function GET(request: NextRequest) {
  if (!(await isAllowed()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const name = String(request.nextUrl.searchParams.get("name") ?? "").trim();
  if (!name)
    return NextResponse.json({ records: [] });

  const [closedStatus, awardedStatuses] = await Promise.all([
    supabaseAdmin
      .from("option_values")
      .select("id")
      .eq("system_key", "client_status_closed")
      .maybeSingle(),
    supabaseAdmin
      .from("option_values")
      .select("id")
      .in("system_key", [
        "subitem_status_awarded",
        "subitem_status_verify_later",
        "subitem_status_verified",
        "subitem_status_variation_cost_difference",
      ]),
  ]);
  if (closedStatus.error || awardedStatuses.error)
    return NextResponse.json(
      { error: closedStatus.error?.message ?? awardedStatuses.error?.message },
      { status: 500 },
    );
  if (!closedStatus.data?.id || !(awardedStatuses.data ?? []).length)
    return NextResponse.json({ records: [] });

  const { data: closedClients, error: clientsError } = await supabaseAdmin
    .from("clients")
    .select("id, name, display_id")
    .eq("status_option_id", closedStatus.data.id)
    .is("deleted_at", null);
  if (clientsError)
    return NextResponse.json({ error: clientsError.message }, { status: 500 });
  const clientIds = (closedClients ?? []).map((client) => client.id);
  if (!clientIds.length) return NextResponse.json({ records: [] });

  const { data: subitems, error: subitemsError } = await supabaseAdmin
    .from("subitems")
    .select("id, client_id, created_at, name, qty, cost, currency, currency_option_id, manpower, ls, os, up")
    .in("client_id", clientIds)
    .eq("name", name)
    .in("status_option_id", (awardedStatuses.data ?? []).map((status) => status.id))
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (subitemsError)
    return NextResponse.json({ error: subitemsError.message }, { status: 500 });

  const clientsById = new Map((closedClients ?? []).map((client) => [client.id, client]));
  return NextResponse.json({
    records: (subitems ?? []).map((subitem) => {
      const client = clientsById.get(subitem.client_id);
      return {
        id: subitem.id,
        clientId: subitem.client_id,
        clientName: client?.name ?? "Unnamed client",
        clientDisplayId: client?.display_id ?? "",
        createdAt: subitem.created_at,
        qty: subitem.qty ?? "",
        cost: subitem.cost ?? "",
        currency: subitem.currency ?? "",
        currencyOptionId: subitem.currency_option_id ?? null,
        manpower: subitem.manpower ?? "",
        ls: subitem.ls ?? "",
        os: subitem.os ?? "",
        up: subitem.up ?? "",
      };
    }),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BOARD_PAGE_RPCS = new Set([
  "crm_board_initial_page_hydrated_v1",
  "crm_board_group_page_hydrated_fast_v1",
  "crm_board_standard_filter_page_hydrated_v1",
  "crm_board_client_page_hydrated_indexed_v1",
]);

/**
 * Same-origin transport fallback for Board page reads.
 *
 * Some Safari sessions can lose a direct cross-origin PostgREST response
 * after the request reaches Supabase (Web Inspector then shows no response
 * headers/body). This route keeps the database call and caller JWT semantics
 * unchanged, while moving that browser-to-Supabase hop to the server.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    rpc?: unknown;
    params?: unknown;
  } | null;
  const rpc = typeof body?.rpc === "string" ? body.rpc : "";
  if (!BOARD_PAGE_RPCS.has(rpc) || !body?.params || typeof body.params !== "object")
    return NextResponse.json({ error: "Invalid Board page request" }, { status: 400 });

  // The RPC name is restricted above. `params` is passed through exactly as
  // the browser would send it to PostgREST, preserving filter/sort behaviour.
  const { data, error } = await supabase.rpc(rpc, body.params as never);
  if (error)
    return NextResponse.json(
      { error: error.message, code: error.code ?? null },
      { status: 500 },
    );
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

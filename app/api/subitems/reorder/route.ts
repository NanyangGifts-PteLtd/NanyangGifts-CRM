import { NextRequest, NextResponse } from "next/server";
import { canEditClient } from "@/lib/client-access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { clientId, orderedSubitemIds } = (await request.json()) as {
      clientId?: string;
      orderedSubitemIds?: string[];
    };
    if (
      !clientId ||
      !Array.isArray(orderedSubitemIds) ||
      !orderedSubitemIds.every((id) => typeof id === "string") ||
      new Set(orderedSubitemIds).size !== orderedSubitemIds.length
    ) {
      return NextResponse.json({ error: "Invalid subitem order." }, { status: 400 });
    }

    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await canEditClient(session, clientId, user.id))) {
      return NextResponse.json(
        { error: "You can only reorder subitems for clients you are assigned to." },
        { status: 403 },
      );
    }

    const { error: reorderError } = await supabaseAdmin.rpc(
      "crm_reorder_subitems_v1",
      {
        p_client_id: clientId,
        p_ordered_subitem_ids: orderedSubitemIds,
      },
    );
    if (reorderError) {
      if (reorderError.code === "P0001") {
        return NextResponse.json({ error: reorderError.message }, { status: 409 });
      }
      throw reorderError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Subitem reorder failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not reorder subitems." },
      { status: 500 },
    );
  }
}

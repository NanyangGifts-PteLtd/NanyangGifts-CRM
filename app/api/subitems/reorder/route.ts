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

    const { data: activeSubitems, error: subitemsError } = await supabaseAdmin
      .from("subitems")
      .select("id")
      .eq("client_id", clientId)
      .is("deleted_at", null);
    if (subitemsError) throw subitemsError;

    const activeIds = new Set((activeSubitems ?? []).map((subitem) => subitem.id));
    if (
      activeIds.size !== orderedSubitemIds.length ||
      orderedSubitemIds.some((id) => !activeIds.has(id))
    ) {
      return NextResponse.json(
        { error: "The subitem list changed. Refresh the board and try again." },
        { status: 409 },
      );
    }

    // Move rows through a temporary range first. This works even when the
    // database enforces unique positions per client, avoiding transient clashes.
    const temporaryBase = 1_000_000_000;
    for (const [index, id] of orderedSubitemIds.entries()) {
      const { error } = await supabaseAdmin
        .from("subitems")
        .update({ position: temporaryBase + index })
        .eq("id", id)
        .eq("client_id", clientId)
        .is("deleted_at", null);
      if (error) throw error;
    }
    for (const [index, id] of orderedSubitemIds.entries()) {
      const { error } = await supabaseAdmin
        .from("subitems")
        .update({ position: index })
        .eq("id", id)
        .eq("client_id", clientId)
        .is("deleted_at", null);
      if (error) throw error;
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

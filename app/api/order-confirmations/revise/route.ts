import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canEditClient } from "@/lib/client-access";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
type RevisionItem = {
  id?: unknown;
  imagePath?: unknown;
  needBy?: unknown;
};

async function isPmUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return String(data?.role ?? "").trim().toLowerCase() === "pm";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ocfId = String(body?.ocfId ?? "");
    const items: RevisionItem[] = Array.isArray(body?.items) ? body.items : [];
    if (!ocfId || !items.length) return NextResponse.json({ error: "An OCF and its items are required" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (await isPmUser(supabase, user.id)) return NextResponse.json({ error: "PM users can view and print OCFs but cannot edit them." }, { status: 403 });

    // The caller is authenticated and checked against the client-level edit
    // rule below. Use the server-only client for OCF rows so a stricter child
    // table RLS policy cannot silently turn a valid launcher revision into a
    // zero-row update.
    const { data: ocf, error: ocfError } = await supabaseAdmin
      .from("order_confirmations")
      .select("id, client_id")
      .eq("id", ocfId)
      .maybeSingle();
    if (ocfError || !ocf) return NextResponse.json({ error: "Order confirmation not found" }, { status: 404 });
    if (!(await canEditClient(supabase, ocf.client_id, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const itemIds = items.map((item) => String(item?.id ?? "")).filter(Boolean);
    if (itemIds.length !== items.length || new Set(itemIds).size !== itemIds.length) return NextResponse.json({ error: "Each OCF item must be included once" }, { status: 400 });
    for (const item of items) {
      if (!item?.imagePath || (item.needBy !== "ASAP" && !DATE.test(String(item.needBy ?? "")))) {
        return NextResponse.json({ error: "Every item requires artwork and a Need by Date or ASAP." }, { status: 400 });
      }
    }

    const { data: storedItems, error: storedItemsError } = await supabaseAdmin
      .from("order_confirmation_items")
      .select("id, subitem_id")
      .eq("order_confirmation_id", ocfId);
    if (storedItemsError) throw storedItemsError;
    if ((storedItems ?? []).length !== itemIds.length || (storedItems ?? []).some((item) => !itemIds.includes(item.id))) {
      return NextResponse.json({ error: "The OCF item list has changed. Reopen the editor and try again." }, { status: 409 });
    }

    const subitemIds = (storedItems ?? []).map((item) => item.subitem_id).filter(Boolean);
    const { data: subitems, error: subitemsError } = await supabaseAdmin
      .from("subitems")
      .select("id, qty, description")
      .eq("client_id", ocf.client_id)
      .in("id", subitemIds);
    if (subitemsError) throw subitemsError;
    const qtyBySubitemId = new Map((subitems ?? []).map((item) => [item.id, item.qty]));
    const descriptionBySubitemId = new Map(
      (subitems ?? []).map((item) => [item.id, item.description ?? ""]),
    );
    if (qtyBySubitemId.size !== subitemIds.length) return NextResponse.json({ error: "One or more linked CRM subitems no longer exist." }, { status: 409 });
    const sourceByOcfItemId = new Map((storedItems ?? []).map((item) => [item.id, item]));

    const { error: ocfUpdateError } = await supabaseAdmin.from("order_confirmations").update({
      company_snapshot: String(body?.companyName ?? "").trim(),
      client_email_snapshot: String(body?.clientEmail ?? "").trim() || null,
      estimated_delivery_notes: String(body?.estimatedDeliveryNotes ?? ""),
      // A material revision invalidates the previous client acknowledgement.
      status: "draft",
      terms_read: false,
      terms_agreed: false,
      artwork_confirmed_item_ids: [],
      strict_need_by_date: false,
      client_signature_path: null,
      client_signed_at: null,
      client_submitted_at: null,
      client_ip: null,
      locked_at: null,
    }).eq("id", ocfId);
    if (ocfUpdateError) throw ocfUpdateError;

    for (const item of items) {
      const source = sourceByOcfItemId.get(item.id);
      if (!source?.subitem_id) return NextResponse.json({ error: "Invalid OCF item" }, { status: 400 });
      const { data: updatedItem, error } = await supabaseAdmin
        .from("order_confirmation_items")
        .update({
        qty: qtyBySubitemId.get(source.subitem_id),
        // The OCF's internal `remarks` column is the snapshot displayed to
        // users as Description. Refresh it alongside quantity and artwork.
        remarks: descriptionBySubitemId.get(source.subitem_id) ?? "",
        image_path: item.imagePath,
        need_by_date: item.needBy,
      })
        .eq("id", item.id)
        .eq("order_confirmation_id", ocfId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updatedItem) {
        return NextResponse.json(
          { error: "Order confirmation item not found" },
          { status: 404 },
        );
      }
    }

    await supabaseAdmin.from("activity_log").insert({
      client_id: ocf.client_id,
      actor_name: user.email ?? "CRM user",
      action: "ocf_updated",
      title: "Order Confirmation Form revised",
      description: "Artwork or quantity was revised; client confirmation was reset.",
      link: `/app/order-confirmations/${ocfId}`,
      meta: { ocfId, revision: true },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to revise OCF" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canEditClient } from "@/lib/client-access";
import { updateCrmSpreadsheetDeliveryInfo } from "@/lib/shipper/spreadsheet";
import { withOcfNeedByTimeline } from "@/lib/ocf-need-by";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
type InternalOcfItem = {
  id?: unknown;
  need_by_date?: unknown;
  remarks?: unknown;
  delivery_name?: unknown;
  delivery_address?: unknown;
  delivery_contact_number?: unknown;
  delivery_remarks?: unknown;
};

async function isPmUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return String(profile?.role ?? "").trim().toLowerCase() === "pm";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const ocfId = body?.ocfId;
    const estimatedDeliveryNotes = body?.estimatedDeliveryNotes ?? "";
    const clientNameSnapshot = body?.clientNameSnapshot;
    const companySnapshot = body?.companySnapshot;
    const sameAddressForAllItems = body?.sameAddressForAllItems;
    const syncNeedByToTimeline = body?.syncNeedByToTimeline === true;
    const items: InternalOcfItem[] = Array.isArray(body?.items)
      ? body.items
      : [];

    if (!ocfId) {
      return NextResponse.json({ error: "Missing ocfId" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (await isPmUser(supabase, user.id)) {
      return NextResponse.json(
        { error: "PM users can view and print OCFs but cannot edit them." },
        { status: 403 },
      );
    }

    // Permission is established with the caller's authenticated client above.
    // Use the server-only admin client for the OCF rows themselves: the
    // child-table RLS policy is not the same as the client-level edit rule and
    // can otherwise make an existing OCF item look as though it does not exist.
    const { data: ocf, error: ocfLookupError } = await supabaseAdmin
      .from("order_confirmations")
      .select("client_id, status, locked_at")
      .eq("id", ocfId)
      .single();
    if (ocfLookupError || !ocf) {
      return NextResponse.json(
        { error: "Order confirmation not found" },
        { status: 404 },
      );
    }
    if (!(await canEditClient(supabase, ocf.client_id, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      ocf.locked_at ||
      ocf.status === "locked" ||
      ocf.status === "submitted"
    ) {
      return NextResponse.json(
        {
          error:
            "This order confirmation form is locked and can no longer be edited",
        },
        { status: 403 },
      );
    }

    for (const item of items) {
      if (!item?.id) {
        return NextResponse.json(
          { error: "Each order confirmation item must have an ID" },
          { status: 400 },
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(item, "need_by_date") &&
        item.need_by_date !== "ASAP" &&
        !ISO_DATE_PATTERN.test(String(item.need_by_date ?? ""))
      ) {
        return NextResponse.json(
          { error: "Every item needs a Need by Date or ASAP" },
          { status: 400 },
        );
      }
    }

    const needByDateByItemId = new Map<string, string>();
    for (const item of items) {
      const hasNeedByDate = Object.prototype.hasOwnProperty.call(
        item,
        "need_by_date",
      );
      const needByDate = hasNeedByDate ? String(item.need_by_date) : null;
      if (hasNeedByDate && needByDate) {
        needByDateByItemId.set(String(item.id), needByDate);
      }
    }

    const { data: savedItems, error: saveError } = await supabaseAdmin.rpc(
      "save_order_confirmation_internal_v1",
      {
        p_ocf_id: ocfId,
        p_estimated_delivery_notes: estimatedDeliveryNotes,
        p_client_name_snapshot:
          typeof clientNameSnapshot === "string" ? clientNameSnapshot : null,
        p_company_snapshot:
          typeof companySnapshot === "string" ? companySnapshot : null,
        p_same_address_for_all_items:
          typeof sameAddressForAllItems === "boolean"
            ? sameAddressForAllItems
            : null,
        p_items: items.map((item) => ({
          id: String(item.id ?? ""),
          need_by_date:
            item.need_by_date === null || item.need_by_date === undefined
              ? null
              : String(item.need_by_date),
          remarks: String(item.remarks ?? ""),
          delivery_name:
            item.delivery_name === null || item.delivery_name === undefined
              ? null
              : String(item.delivery_name),
          delivery_address:
            item.delivery_address === null || item.delivery_address === undefined
              ? null
              : String(item.delivery_address),
          delivery_contact_number:
            item.delivery_contact_number === null ||
            item.delivery_contact_number === undefined
              ? null
              : String(item.delivery_contact_number),
          delivery_remarks:
            item.delivery_remarks === null || item.delivery_remarks === undefined
              ? null
              : String(item.delivery_remarks),
        })),
      },
    );

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 409 });
    }
    if ((savedItems ?? []).length !== items.length) {
      return NextResponse.json(
        { error: "The OCF item list changed. Reopen the editor and try again." },
        { status: 409 },
      );
    }

    const needByUpdates = new Map<string, string>();
    for (const updatedItem of savedItems ?? []) {
      const needByDate = needByDateByItemId.get(updatedItem.item_id);
      if (
        syncNeedByToTimeline &&
        updatedItem.subitem_id &&
        needByDate
      ) {
        needByUpdates.set(updatedItem.subitem_id, needByDate);
      }

      await updateCrmSpreadsheetDeliveryInfo([
        {
          sourceSubitemId: updatedItem.subitem_id,
          deliveryInfo:
            [
              updatedItem.delivery_name
                ? `Name: ${updatedItem.delivery_name}`
                : null,
              updatedItem.delivery_contact_number
                ? `Contact: ${updatedItem.delivery_contact_number}`
                : null,
              updatedItem.delivery_address
                ? `Address: ${updatedItem.delivery_address}`
                : null,
              updatedItem.delivery_remarks
                ? `Remarks: ${updatedItem.delivery_remarks}`
                : null,
            ]
              .filter(Boolean)
              .join("\n") || null,
        },
      ]);
    }

    let timelineWarning: string | null = null;
    if (needByUpdates.size > 0) {
      const subitemIds = [...needByUpdates.keys()];
      const { data: subitems, error: subitemsError } = await supabaseAdmin
        .from("subitems")
        .select("id, timeline_rows, timeline_groups")
        .in("id", subitemIds);

      if (subitemsError) {
        timelineWarning =
          "The OCF was saved, but its NBD could not be sent to the project timeline. Please save again.";
      } else {
        const foundIds = new Set((subitems ?? []).map((subitem) => subitem.id));
        const timelineUpdateErrors = await Promise.all(
          (subitems ?? []).map(async (subitem) => {
            const { timelineRows, timelineGroups } = withOcfNeedByTimeline({
              timelineRows: subitem.timeline_rows,
              timelineGroups: subitem.timeline_groups,
              needBy: needByUpdates.get(subitem.id)!,
            });
            const { error } = await supabaseAdmin
              .from("subitems")
              .update({
                timeline_rows: timelineRows,
                timeline_groups: timelineGroups,
              })
              .eq("id", subitem.id);
            return error;
          }),
        );

        if (
          foundIds.size !== subitemIds.length ||
          timelineUpdateErrors.some(Boolean)
        ) {
          timelineWarning =
            "The OCF was saved, but one or more NBD values could not be sent to the project timeline. Please save again.";
        }
      }
    }

    await supabaseAdmin.from("activity_log").insert({
      client_id: ocf.client_id,
      subitem_id: null,
      actor_name: "CRM user",
      action: "ocf_updated",
      field_name: null,
      old_value: null,
      new_value: null,
      title: "Order Confirmation Form updated",
      description: "Internal OCF details were updated.",
      link: `/app/order-confirmations/${ocfId}`,
      meta: { ocfId },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, timelineWarning });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 },
    );
  }
}

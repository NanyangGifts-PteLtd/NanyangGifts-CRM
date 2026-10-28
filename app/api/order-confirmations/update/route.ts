import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditClient } from "@/lib/client-access";
import { updateCrmSpreadsheetDeliveryInfo } from "@/lib/shipper/spreadsheet";
import { withOcfNeedByTimeline } from "@/lib/ocf-need-by";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const ocfId = body?.ocfId;
    const estimatedDeliveryNotes = body?.estimatedDeliveryNotes ?? "";
    const clientNameSnapshot = body?.clientNameSnapshot;
    const companySnapshot = body?.companySnapshot;
    const sameAddressForAllItems = body?.sameAddressForAllItems;
    const syncNeedByToTimeline = body?.syncNeedByToTimeline === true;
    const items = Array.isArray(body?.items) ? body.items : [];

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

    const { data: ocf, error: ocfLookupError } = await supabase
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

    const { error: ocfError } = await supabase
      .from("order_confirmations")
      .update({
        estimated_delivery_notes: estimatedDeliveryNotes,
        ...(typeof clientNameSnapshot === "string"
          ? { client_name_snapshot: clientNameSnapshot }
          : {}),
        ...(typeof companySnapshot === "string"
          ? { company_snapshot: companySnapshot }
          : {}),
        ...(typeof sameAddressForAllItems === "boolean"
          ? { same_address_for_all_items: sameAddressForAllItems }
          : {}),
      })
      .eq("id", ocfId);

    if (ocfError) {
      return NextResponse.json({ error: ocfError.message }, { status: 500 });
    }

    const needByUpdates = new Map<string, string>();

    for (const item of items) {
      const hasNeedByDate = Object.prototype.hasOwnProperty.call(
        item,
        "need_by_date",
      );
      const needByDate = hasNeedByDate ? String(item.need_by_date) : null;
      const { data: updatedItem, error: itemError } = await supabase
        .from("order_confirmation_items")
        .update({
          remarks: item.remarks ?? "",
          delivery_name: item.delivery_name ?? null,
          delivery_address: item.delivery_address ?? null,
          delivery_contact_number: item.delivery_contact_number ?? null,
          delivery_remarks: item.delivery_remarks ?? null,
          ...(hasNeedByDate ? { need_by_date: needByDate } : {}),
        })
        .eq("id", item.id)
        .eq("order_confirmation_id", ocfId)
        .select(
          "subitem_id, delivery_name, delivery_address, delivery_contact_number, delivery_remarks",
        )
        .maybeSingle();

      if (itemError) {
        return NextResponse.json({ error: itemError.message }, { status: 500 });
      }
      if (!updatedItem) {
        return NextResponse.json(
          { error: "Order confirmation item not found" },
          { status: 404 },
        );
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

      if (
        hasNeedByDate &&
        updatedItem.subitem_id &&
        syncNeedByToTimeline
      ) {
        needByUpdates.set(updatedItem.subitem_id, needByDate!);
      }
    }

    let timelineWarning: string | null = null;
    if (needByUpdates.size > 0) {
      const subitemIds = [...needByUpdates.keys()];
      const { data: subitems, error: subitemsError } = await supabase
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
            const { error } = await supabase
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

    await supabase.from("activity_log").insert({
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

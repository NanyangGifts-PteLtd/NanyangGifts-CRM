import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);
const EDITABLE_FIELDS = new Set([
  "date_sent",
  "people_id",
  "people_ids",
  "cost",
  "remarks",
  "status",
  "reason",
  "courier",
  "trip_id",
  "items_sent",
  "relatedSubitemIds",
  "has_quickbooks_bill",
  "quickbooks_invoice_number",
  "quickbooks_supplier_id",
  "quickbooks_supplier_name",
  "qty",
  "verified",
  "discussed",
]);

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !INTERNAL_ROLES.has(String(profile?.role ?? "").toLowerCase())) {
    throw new Error("Forbidden");
  }
  return { user, role: String(profile?.role ?? "").toLowerCase() };
}

function failure(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Additional Costs request failed";
  return NextResponse.json(
    { error: message },
    {
      status:
        message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400,
    },
  );
}

const LABEL_CODE_BY_FIELD: Record<string, string> = {
  status: "additional_cost_status",
  reason: "additional_cost_reason",
  courier: "additional_cost_courier",
};

async function resolveLabel(code: string, value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return { value: "", id: null };
  const { data, error } = await supabaseAdmin
    .from("option_values")
    .select("id, value, option_groups!inner(code)")
    .eq("option_groups.code", code)
    .eq("value", text)
    .maybeSingle();
  if (error || !data) throw new Error(`“${text}” is not a valid label.`);
  return { value: data.value, id: data.id };
}

const ADDITIONAL_COST_STATUS = "[Variation] Cost Difference";
const ADDITIONAL_COST_STATUS_KEY = "subitem_status_variation_cost_difference";
const COURIER_VOUCHER_COURIERS = new Set(["Lalamove", "Easyparcel"]);

async function nextPaymentVoucherReference() {
  const { data, error } = await supabaseAdmin.rpc(
    "next_payment_voucher_reference_id",
  );
  if (error || data === null) throw error ?? new Error("Could not allocate a Payment Voucher Reference ID.");
  return String(data);
}

async function ensureAdditionalCostStatus() {
  const { data: group, error: groupError } = await supabaseAdmin
    .from("option_groups")
    .select("id")
    .eq("code", "subitem_status")
    .maybeSingle();
  if (groupError || !group) {
    throw new Error(
      "The standard Subitem Status labels could not be identified.",
    );
  }
  const { data: systemOption, error: systemOptionError } = await supabaseAdmin
    .from("option_values")
    .select("id, value")
    .eq("group_id", group.id)
    .eq("system_key", ADDITIONAL_COST_STATUS_KEY)
    .maybeSingle();
  if (systemOptionError) throw systemOptionError;
  if (systemOption) return { id: systemOption.id, value: systemOption.value };
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("option_values")
    .select("id, value")
    .eq("group_id", group.id)
    .eq("value", ADDITIONAL_COST_STATUS)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { id: existing.id, value: existing.value };

  const { data: latest, error: latestError } = await supabaseAdmin
    .from("option_values")
    .select("sort_order")
    .eq("group_id", group.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;
  const { data: created, error: createError } = await supabaseAdmin
    .from("option_values")
    .insert({
      group_id: group.id,
      value: ADDITIONAL_COST_STATUS,
      color: "#64748b",
      system_key: ADDITIONAL_COST_STATUS_KEY,
      sort_order: Number(latest?.sort_order ?? -1) + 1,
      section_index: 0,
    })
    .select("id, value")
    .single();
  if (createError) throw createError;
  return created;
}

async function addActivityLog(params: {
  clientId: string;
  subitemId: string | null;
  subitemName: string;
  actorId: string;
  action: "subitem_added" | "subitem_deleted";
  title: string;
}) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", params.actorId)
    .maybeSingle();
  const actorName =
    profile?.full_name?.trim() || profile?.email || "Unknown user";
  const { error } = await supabaseAdmin.from("activity_log").insert({
    client_id: params.clientId,
    subitem_id: params.subitemId,
    subitem_name: params.subitemName,
    actor_name: actorName,
    action: params.action,
    title: params.title,
    meta: { linkedEntity: "additional_cost" },
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function GET() {
  try {
    await authorize();
    const { data, error } = await supabaseAdmin
      .from("additional_costs")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, role } = await authorize();
    const body = (await request.json()) as {
      clientId?: string;
      values?: {
        cost?: unknown;
        reason?: unknown;
        relatedSubitemIds?: unknown;
        courier?: unknown;
        remarks?: unknown;
      };
    };
    if (!body.clientId)
      throw new Error("Choose a client before creating an additional cost.");
    const cost = Number(body.values?.cost);
    const reason = await resolveLabel(
      "additional_cost_reason",
      body.values?.reason,
    );
    const courier = await resolveLabel(
      "additional_cost_courier",
      body.values?.courier,
    );
    const relatedSubitemIds = Array.isArray(body.values?.relatedSubitemIds)
      ? [...new Set(body.values.relatedSubitemIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))]
      : [];
    if (!Number.isFinite(cost) || cost <= 0)
      throw new Error("Cost must be greater than zero.");
    if (!reason.value) throw new Error("Choose a Reason label.");
    if (!relatedSubitemIds.length)
      throw new Error("Select at least one Related Subitem.");
    if (
      reason.value.trim().toLocaleLowerCase() === "other" &&
      !String(body.values?.remarks ?? "").trim()
    )
      throw new Error("Remarks is required when Reason is Other.");
    if (!courier.value || !["Lalamove", "Easyparcel"].includes(courier.value))
      throw new Error("Choose Lalamove or Easyparcel as the Courier.");
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, custom_fields")
      .eq("id", body.clientId)
      .is("deleted_at", null)
      .maybeSingle();
    if (clientError || !client)
      throw new Error("The selected client is no longer available.");
    const { data: relatedSubitems, error: relatedSubitemsError } =
      await supabaseAdmin
        .from("subitems")
        .select("id, name, custom_fields")
        .eq("client_id", client.id)
        .is("deleted_at", null)
        .in("id", relatedSubitemIds);
    if (relatedSubitemsError) throw relatedSubitemsError;
    if (
      (relatedSubitems ?? []).length !== relatedSubitemIds.length ||
      (relatedSubitems ?? []).some(
        (subitem) => subitem.custom_fields?.additionalCostId,
      )
    )
      throw new Error("One or more selected Related Subitems are unavailable.");
    const relatedNameById = new Map(
      (relatedSubitems ?? []).map((subitem) => [subitem.id, subitem.name]),
    );
    const itemsSent = relatedSubitemIds
      .map((id) => relatedNameById.get(id) ?? "")
      .filter(Boolean)
      .join(", ");
    if (client.custom_fields?.subitemsLocked === "true") {
      throw new Error(
        "This client is locked. Unlock its subitems on the CRM Board before adding an additional cost.",
      );
    }
    // Creating an additional cost effectively adds a subitem to the client,
    // so it follows the CRM Board's client edit-assignment rule.
    if (!["admin", "director"].includes(role)) {
      const { data: assignment, error: assignmentError } = await supabaseAdmin
        .from("client_assignees")
        .select("client_id")
        .eq("client_id", client.id)
        .eq("user_id", user.id)
        .in("assignment_type", ["people", "pm"])
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) {
        throw new Error(
          "You can only create additional costs for clients assigned to you.",
        );
      }
    }
    const createdAt = new Date().toISOString();
    const status = await ensureAdditionalCostStatus();
    const { data: latest, error: latestError } = await supabaseAdmin
      .from("additional_costs")
      .select("position")
      .eq("client_id", client.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;
    const nextReference = await nextPaymentVoucherReference();
    const { data, error } = await supabaseAdmin
      .from("additional_costs")
      .insert({
        client_id: client.id,
        position: Number(latest?.position ?? -1) + 1,
        created_by: user.id,
        created_at: createdAt,
        cost,
        reason: reason.value,
        reason_option_id: reason.id,
        items_sent: itemsSent,
        courier: courier.value,
        courier_option_id: courier.id,
        remarks: String(body.values?.remarks ?? "").trim(),
        trip_id: nextReference,
      })
      .select("*")
      .single();
    if (error) throw error;
    try {
      const { data: lastSubitem, error: lastSubitemError } = await supabaseAdmin
        .from("subitems")
        .select("position")
        .eq("client_id", client.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastSubitemError) throw lastSubitemError;
      const { data: subitem, error: subitemError } = await supabaseAdmin
        .from("subitems")
        .insert({
          client_id: client.id,
          position: Number(lastSubitem?.position ?? -1) + 1,
          created_at: createdAt,
          name: courier.value,
          status: status.value,
          status_option_id: status.id,
          qty: "1",
          currency: "SGD",
          cost: String(cost),
          custom_fields: {
            additionalCostId: data.id,
            additionalCostLinked: "true",
          },
        })
        .select("id, name")
        .single();
      if (subitemError) throw subitemError;
      const { error: assignmentError } = await supabaseAdmin
        .from("subitem_assignees")
        .insert({
          subitem_id: subitem.id,
          user_id: user.id,
          assigned_by: user.id,
        });
      if (assignmentError) throw assignmentError;
      await addActivityLog({
        clientId: client.id,
        subitemId: subitem.id,
        subitemName: subitem.name ?? "Additional Cost",
        actorId: user.id,
        action: "subitem_added",
        title: "added an Additional Cost subitem",
      });
    } catch (creationError) {
      await supabaseAdmin.from("additional_costs").delete().eq("id", data.id);
      throw creationError;
    }
    return NextResponse.json({ row: data }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, role } = await authorize();
    const body = (await request.json()) as {
      id?: string;
      values?: Record<string, unknown>;
    };
    if (!body.id || !body.values)
      throw new Error("An additional cost and changes are required.");
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("additional_costs")
      .select("*")
      .eq("id", body.id)
      .maybeSingle();
    if (existingError || !existing) throw new Error("Additional cost not found.");
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("custom_fields")
      .eq("id", existing.client_id)
      .maybeSingle();
    if (clientError || !client) throw new Error("Linked client not found.");
    if (client.custom_fields?.subitemsLocked === "true") {
      throw new Error(
        "This client's subitems are locked. Check with the director if there are any changes.",
      );
    }
    if (!["admin", "director"].includes(role)) {
      const { data: assignment, error: assignmentError } = await supabaseAdmin
        .from("client_assignees")
        .select("client_id")
        .eq("client_id", existing.client_id)
        .eq("user_id", user.id)
        .in("assignment_type", ["people", "pm"])
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment)
        throw new Error(
          "You can only edit payment vouchers for clients assigned to you.",
        );
    }
    const values = Object.fromEntries(
      Object.entries(body.values).filter(([field]) =>
        EDITABLE_FIELDS.has(field),
      ),
    );
    if (!Object.keys(values).length)
      throw new Error("No editable changes were supplied.");
    const isOtherVoucher = !COURIER_VOUCHER_COURIERS.has(
      String(existing.courier ?? ""),
    );
    if (
      (values.has_quickbooks_bill !== undefined ||
        values.quickbooks_invoice_number !== undefined ||
        values.quickbooks_supplier_id !== undefined ||
        values.quickbooks_supplier_name !== undefined) &&
      !isOtherVoucher
    )
      throw new Error("QuickBooks Bill fields are only available for the Manpower/UPS Charges/Other payments group.");
    if (values.has_quickbooks_bill !== undefined) {
      const hasBill = values.has_quickbooks_bill === true || values.has_quickbooks_bill === "true";
      values.has_quickbooks_bill = hasBill;
      if (!hasBill) {
        values.quickbooks_invoice_number = "";
        values.quickbooks_supplier_id = "";
        values.quickbooks_supplier_name = "";
      }
    }
    const hasQuickBooksBill = values.has_quickbooks_bill === undefined
      ? Boolean(existing.has_quickbooks_bill)
      : Boolean(values.has_quickbooks_bill);
    if (!hasQuickBooksBill) {
      if (values.quickbooks_invoice_number !== undefined || values.quickbooks_supplier_id !== undefined || values.quickbooks_supplier_name !== undefined) {
        values.quickbooks_invoice_number = "";
        values.quickbooks_supplier_id = "";
        values.quickbooks_supplier_name = "";
      }
    }
    if (
      values.cost !== undefined &&
      values.cost !== null &&
      values.cost !== ""
    ) {
      const cost = Number(values.cost);
      if (!Number.isFinite(cost) || cost <= 0)
        throw new Error("Cost must be greater than zero.");
      values.cost = cost;
    }
    if (values.relatedSubitemIds !== undefined) {
      if (!Array.isArray(values.relatedSubitemIds) || !values.relatedSubitemIds.length)
        throw new Error("Select at least one Related Subitem.");
      const ids = [...new Set(values.relatedSubitemIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
      const { data: relatedSubitems, error: relatedSubitemsError } =
        await supabaseAdmin
          .from("subitems")
          .select("id, name, custom_fields")
          .eq("client_id", existing.client_id)
          .is("deleted_at", null)
          .in("id", ids);
      if (relatedSubitemsError) throw relatedSubitemsError;
      if (
        (relatedSubitems ?? []).length !== ids.length ||
        (relatedSubitems ?? []).some(
          (subitem) => subitem.custom_fields?.additionalCostId,
        )
      )
        throw new Error("One or more selected Related Subitems are unavailable.");
      const names = new Map((relatedSubitems ?? []).map((subitem) => [subitem.id, subitem.name]));
      values.items_sent = ids.map((id) => names.get(id) ?? "").filter(Boolean).join(", ");
      delete values.relatedSubitemIds;
    }
    if (values.items_sent !== undefined && !String(values.items_sent).trim())
      throw new Error("Select at least one Related Subitem.");
    if (values.people_ids !== undefined) {
      if (
        !Array.isArray(values.people_ids) ||
        values.people_ids.some((id) => typeof id !== "string")
      )
        throw new Error("People must be internal staff.");
      values.people_id = values.people_ids[0] ?? null;
    }
    for (const [field, code] of Object.entries(LABEL_CODE_BY_FIELD)) {
      if (values[field] === undefined) continue;
      const label = await resolveLabel(code, values[field]);
      values[field] = label.value;
      values[`${field}_option_id`] = label.id;
    }
    if (
      String(values.reason ?? existing.reason ?? "").trim().toLocaleLowerCase() ===
        "other" &&
      !String(values.remarks ?? existing.remarks ?? "").trim()
    )
      throw new Error("Remarks is required when Reason is Other.");
    if (values.courier !== undefined && !values.courier)
      throw new Error("Choose a Courier label.");
    if (values.courier !== undefined) {
      const existingIsCourierVoucher = COURIER_VOUCHER_COURIERS.has(
        String(existing.courier ?? ""),
      );
      const nextIsCourierVoucher = COURIER_VOUCHER_COURIERS.has(
        String(values.courier),
      );
      if (existingIsCourierVoucher !== nextIsCourierVoucher) {
        throw new Error(
          "A Payment Voucher cannot be moved between voucher groups by changing its Courier.",
        );
      }
    }

    const { data: linkedSubitem, error: linkedSubitemError } =
      await supabaseAdmin
        .from("subitems")
        .select("id, name, cost")
        .eq("client_id", existing.client_id)
        .contains("custom_fields", { additionalCostId: existing.id })
        .is("deleted_at", null)
        .maybeSingle();
    if (linkedSubitemError || !linkedSubitem)
      throw new Error("Linked Payment Voucher subitem not found.");

    const linkedChanges = {
      ...(values.cost !== undefined ? { cost: String(values.cost) } : {}),
      ...(values.courier !== undefined ? { name: String(values.courier) } : {}),
    };
    if (Object.keys(linkedChanges).length) {
      const { error: linkedUpdateError } = await supabaseAdmin
        .from("subitems")
        .update(linkedChanges)
        .eq("id", linkedSubitem.id);
      if (linkedUpdateError) throw linkedUpdateError;
    }
    const { data, error } = await supabaseAdmin
      .from("additional_costs")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) {
      if (Object.keys(linkedChanges).length) {
        await supabaseAdmin
          .from("subitems")
          .update({ cost: linkedSubitem.cost, name: linkedSubitem.name })
          .eq("id", linkedSubitem.id);
      }
      throw error;
    }
    return NextResponse.json({ row: data });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, role } = await authorize();
    const id = request.nextUrl.searchParams.get("id");
    const subitemId = request.nextUrl.searchParams.get("subitemId");
    if (!id && !subitemId) throw new Error("An additional cost is required.");
    let linkedSubitem: {
      id: string;
      client_id: string;
      name: string | null;
    } | null = null;
    let additionalCostId = id;
    if (subitemId) {
      const { data: subitem, error: subitemError } = await supabaseAdmin
        .from("subitems")
        .select("id, client_id, name, custom_fields")
        .eq("id", subitemId)
        .maybeSingle();
      if (subitemError || !subitem)
        throw new Error("Linked Additional Cost subitem not found.");
      linkedSubitem = subitem;
      additionalCostId = String(subitem.custom_fields?.additionalCostId ?? "");
      if (!additionalCostId)
        throw new Error("This subitem is not linked to an Additional Cost.");
    }
    const { data: record, error: recordError } = await supabaseAdmin
      .from("additional_costs")
      .select("id, client_id")
      .eq("id", additionalCostId ?? "")
      .is("deleted_at", null)
      .maybeSingle();
    if (recordError || !record) throw new Error("Additional cost not found.");
    // Match the CRM Board's deletion rule: admins/directors can delete any
    // record; other internal staff must be assigned to its linked client as
    // either People or PM. Edit rules will be added separately.
    if (!["admin", "director"].includes(role)) {
      const { data: assignment, error: assignmentError } = await supabaseAdmin
        .from("client_assignees")
        .select("client_id")
        .eq("client_id", record.client_id)
        .eq("user_id", user.id)
        .in("assignment_type", ["people", "pm"])
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment)
        throw new Error(
          "You can only delete additional costs for clients assigned to you.",
        );
    }
    if (id) {
      const { data: subitem, error: subitemError } = await supabaseAdmin
        .from("subitems")
        .select("id, client_id, name")
        .eq("client_id", record.client_id)
        .contains("custom_fields", { additionalCostId: record.id })
        .is("deleted_at", null)
        .maybeSingle();
      if (subitemError) throw subitemError;
      linkedSubitem = subitem;
    }
    const deletedAt = new Date().toISOString();
    if (linkedSubitem) {
      const { error: subitemDeleteError } = await supabaseAdmin
        .from("subitems")
        .update({
          deleted_at: deletedAt,
          deleted_by: user.id,
          deleted_with_client_id: null,
        })
        .eq("id", linkedSubitem.id);
      if (subitemDeleteError) throw subitemDeleteError;
      await addActivityLog({
        clientId: linkedSubitem.client_id,
        subitemId: null,
        subitemName: linkedSubitem.name ?? "Additional Cost",
        actorId: user.id,
        action: "subitem_deleted",
        title: "moved linked Additional Cost subitem to the Bin",
      });
    }
    const { error } = await supabaseAdmin
      .from("additional_costs")
      .update({ deleted_at: deletedAt, deleted_by: user.id })
      .eq("id", record.id)
      .is("deleted_at", null);
    if (error) {
      if (linkedSubitem) {
        await supabaseAdmin
          .from("subitems")
          .update({ deleted_at: null, deleted_by: null })
          .eq("id", linkedSubitem.id);
      }
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

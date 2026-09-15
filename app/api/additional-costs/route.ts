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

export async function GET() {
  try {
    await authorize();
    const { data, error } = await supabaseAdmin
      .from("additional_costs")
      .select("*")
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
    const body = (await request.json()) as { clientId?: string };
    if (!body.clientId)
      throw new Error("Choose a client before creating an additional cost.");
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, custom_fields")
      .eq("id", body.clientId)
      .is("deleted_at", null)
      .maybeSingle();
    if (clientError || !client)
      throw new Error("The selected client is no longer available.");
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
    const { data: latest, error: latestError } = await supabaseAdmin
      .from("additional_costs")
      .select("position")
      .eq("client_id", client.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;
    const { data, error } = await supabaseAdmin
      .from("additional_costs")
      .insert({
        client_id: client.id,
        position: Number(latest?.position ?? -1) + 1,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await authorize();
    const body = (await request.json()) as {
      id?: string;
      values?: Record<string, unknown>;
    };
    if (!body.id || !body.values)
      throw new Error("An additional cost and changes are required.");
    const values = Object.fromEntries(
      Object.entries(body.values).filter(([field]) =>
        EDITABLE_FIELDS.has(field),
      ),
    );
    if (!Object.keys(values).length)
      throw new Error("No editable changes were supplied.");
    if (
      values.cost !== undefined &&
      values.cost !== null &&
      values.cost !== ""
    ) {
      const cost = Number(values.cost);
      if (!Number.isFinite(cost)) throw new Error("Cost must be a number.");
      values.cost = cost;
    }
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
    const { data, error } = await supabaseAdmin
      .from("additional_costs")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, role } = await authorize();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) throw new Error("An additional cost is required.");
    const { data: record, error: recordError } = await supabaseAdmin
      .from("additional_costs")
      .select("client_id")
      .eq("id", id)
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
    const { error } = await supabaseAdmin
      .from("additional_costs")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

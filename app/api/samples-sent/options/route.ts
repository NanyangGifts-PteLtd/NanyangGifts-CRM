import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CODES = ["samples_sent_status", "samples_sent_reason", "samples_sent_courier"];
const DELETE_ROLES = new Set(["admin", "director", "dev"]);

const FIELD_BY_CODE: Record<string, { value: string; optionId: string }> = {
  samples_sent_status: { value: "status", optionId: "status_option_id" },
  samples_sent_reason: { value: "reason", optionId: "reason_option_id" },
  samples_sent_courier: { value: "courier", optionId: "courier_option_id" },
};

async function authorisedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  const role = String(profile?.role ?? "").toLowerCase();
  if (!new Set(["sales", "pm", "admin", "director", "dev"]).has(role)) {
    throw new Error("Forbidden");
  }
  return { role };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not update Samples Sent labels.";
  return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400 });
}

export async function GET() {
  try {
    const { role } = await authorisedUser();
    const { data: groups, error } = await supabaseAdmin.from("option_groups").select("id, code").in("code", CODES);
    if (error) throw error;
    const ids = (groups ?? []).map((group) => group.id);
    const { data: values, error: valuesError } = ids.length
      ? await supabaseAdmin.from("option_values").select("id, group_id, value, color, section_index, system_key").in("group_id", ids).order("section_index").order("sort_order")
      : { data: [], error: null };
    if (valuesError) throw valuesError;
    return NextResponse.json({ groups: groups ?? [], values: values ?? [], canDelete: DELETE_ROLES.has(role) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { role } = await authorisedUser();
    const body = await request.json();
    const code = String(body?.code ?? "");
    const action = String(body?.action ?? "");
    const config = FIELD_BY_CODE[code];
    if (!config) throw new Error("Unsupported Samples Sent label group.");
    const { data: group, error: groupError } = await supabaseAdmin
      .from("option_groups")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (groupError || !group) throw new Error("Samples Sent labels have not been configured yet.");

    if (action === "reorder") {
      const layout = Array.isArray(body?.layout) ? body.layout : [];
      const { data: options, error: optionsError } = await supabaseAdmin
        .from("option_values")
        .select("id")
        .eq("group_id", group.id);
      if (optionsError) throw optionsError;
      const validIds = new Set((options ?? []).map((option) => option.id));
      if (layout.length !== validIds.size || layout.some((entry: Record<string, unknown>) => !validIds.has(String(entry?.id ?? "")))) {
        throw new Error("The label list changed. Please reopen it and try again.");
      }
      for (let index = 0; index < layout.length; index += 1) {
        const entry = layout[index] as Record<string, unknown>;
        const section = Math.max(0, Number(entry.section) || 0);
        const { error } = await supabaseAdmin
          .from("option_values")
          .update({ section_index: section, sort_order: index })
          .eq("id", String(entry.id));
        if (error) throw error;
      }
    } else if (action === "add") {
      const value = String(body?.value ?? "").trim();
      if (!value) throw new Error("Enter a label name.");
      const { data: existing } = await supabaseAdmin.from("option_values").select("id").eq("group_id", group.id).ilike("value", value).maybeSingle();
      if (existing) throw new Error("A label with that name already exists.");
      const { data: last } = await supabaseAdmin.from("option_values").select("sort_order").eq("group_id", group.id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const { error } = await supabaseAdmin.from("option_values").insert({ group_id: group.id, value, color: "#94a3b8", section_index: 0, sort_order: Number(last?.sort_order ?? -1) + 1 });
      if (error) throw error;
    } else {
      const optionId = String(body?.optionId ?? "").trim();
      if (!optionId) throw new Error("Choose a label.");
      const { data: option, error: optionError } = await supabaseAdmin.from("option_values").select("id, value").eq("id", optionId).eq("group_id", group.id).maybeSingle();
      if (optionError || !option) throw new Error("The label is no longer available.");
      if (action === "rename") {
        const value = String(body?.value ?? "").trim();
        if (!value) throw new Error("Enter a label name.");
        const { data: duplicate } = await supabaseAdmin.from("option_values").select("id").eq("group_id", group.id).ilike("value", value).neq("id", optionId).maybeSingle();
        if (duplicate) throw new Error("A label with that name already exists.");
        const { error } = await supabaseAdmin.from("option_values").update({ value }).eq("id", optionId);
        if (error) throw error;
        const { error: referencesError } = await supabaseAdmin.from("samples_sent").update({ [config.value]: value }).eq(config.optionId, optionId);
        if (referencesError) throw referencesError;
      } else if (action === "color") {
        const color = String(body?.color ?? "").trim();
        if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Choose a valid label colour.");
        const { error } = await supabaseAdmin.from("option_values").update({ color }).eq("id", optionId);
        if (error) throw error;
      } else if (action === "delete") {
        if (!DELETE_ROLES.has(role)) throw new Error("Only administrators, directors, and developers can delete labels.");
        const { count, error: countError } = await supabaseAdmin.from("samples_sent").select("id", { count: "exact", head: true }).eq(config.optionId, optionId);
        if (countError) throw countError;
        if (count) throw new Error(`This label is used by ${count} Samples Sent record${count === 1 ? "" : "s"} and cannot be deleted.`);
        const { error } = await supabaseAdmin.from("option_values").delete().eq("id", optionId);
        if (error) throw error;
      } else {
        throw new Error("Unsupported label update.");
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

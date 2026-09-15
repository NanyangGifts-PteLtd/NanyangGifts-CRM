import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CODES = new Set([
  "additional_cost_status",
  "additional_cost_reason",
  "additional_cost_courier",
]);
async function allowed() {
  const caller = await createClient();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !["admin", "director", "dev"].includes(
      String(data?.role ?? "").toLowerCase(),
    )
  )
    throw new Error("Forbidden");
}
const fail = (error: unknown) =>
  NextResponse.json(
    { error: error instanceof Error ? error.message : "Label update failed" },
    {
      status:
        error instanceof Error && error.message === "Forbidden" ? 403 : 400,
    },
  );
export async function GET() {
  try {
    const caller = await createClient();
    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    const { data: groups, error } = await supabaseAdmin
      .from("option_groups")
      .select("id, code")
      .in("code", [...CODES]);
    if (error) throw error;
    const ids = (groups ?? []).map((group) => group.id);
    const { data: values, error: valueError } = ids.length
      ? await supabaseAdmin
          .from("option_values")
          .select("id, group_id, value, color, section_index")
          .in("group_id", ids)
          .order("sort_order")
      : { data: [], error: null };
    if (valueError) throw valueError;
    return NextResponse.json({ groups: groups ?? [], values: values ?? [] });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    await allowed();
    const body = (await request.json()) as {
      action?: "add" | "color" | "rename";
      code?: string;
      value?: string;
      nextValue?: string;
      color?: string;
    };
    const code = body.code ?? "";
    if (!CODES.has(code)) throw new Error("Invalid label group.");
    const { data: group } = await supabaseAdmin
      .from("option_groups")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!group) throw new Error("Label group was not found.");
    if (body.action === "add") {
      const value = body.value?.trim();
      if (!value) throw new Error("A label name is required.");
      const { data, error } = await supabaseAdmin
        .from("option_values")
        .insert({
          group_id: group.id,
          value,
          color: "#d1d5db",
          sort_order: 999,
          section_index: 0,
        })
        .select("id, value, color, section_index")
        .single();
      if (error) throw error;
      return NextResponse.json({ option: data });
    }
    const value = body.value ?? "";
    if (body.action === "color") {
      const { error } = await supabaseAdmin
        .from("option_values")
        .update({ color: body.color })
        .eq("group_id", group.id)
        .eq("value", value);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (body.action === "rename") {
      const nextValue = body.nextValue?.trim();
      if (!nextValue) throw new Error("A label name is required.");
      const { error } = await supabaseAdmin
        .from("option_values")
        .update({ value: nextValue })
        .eq("group_id", group.id)
        .eq("value", value);
      if (error) throw error;
      const field =
        code === "additional_cost_status"
          ? "status"
          : code === "additional_cost_reason"
            ? "reason"
            : "courier";
      const idField = `${field}_option_id`;
      const { data: option } = await supabaseAdmin
        .from("option_values")
        .select("id")
        .eq("group_id", group.id)
        .eq("value", nextValue)
        .maybeSingle();
      if (option)
        await supabaseAdmin
          .from("additional_costs")
          .update({ [field]: nextValue })
          .eq(idField, option.id);
      return NextResponse.json({ ok: true });
    }
    throw new Error("Invalid label update.");
  } catch (error) {
    return fail(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BOARD_OPTION_CODES = new Set([
  "reply_status",
  "client_status",
  "channel",
  "importance",
  "progress",
  "payment",
  "payment_status",
  "mode_of_payment",
  "shipper",
  "local_overseas",
  "subitem_status",
  "currency",
  "subitem_subprogress",
  "tracking_summary",
  "tracking_invoice_created",
  "tracking_multiple_invoices",
  "tracking_payment_status",
  "tracking_price_invoice_match",
  "overall_payment_status",
  "payment_received",
  "additional_cost_status",
  "additional_cost_reason",
  "additional_cost_courier",
]);

async function canManageLabels() {
  const caller = await createClient();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return ["admin", "director", "dev"].includes(
    profile?.role?.trim().toLowerCase() ?? "",
  );
}

export async function POST(request: NextRequest) {
  if (!(await canManageLabels()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json()) as {
    code?: string;
    values?: string[];
    layout?: Array<{ id?: string; value?: string; section?: number }>;
  };
  const code = body.code?.trim() ?? "";
  const layout = Array.isArray(body.layout)
    ? body.layout.map((item) => ({
        id: item.id?.trim() || undefined,
        value: typeof item.value === "string" ? item.value : "",
        section:
          Number.isInteger(item.section) && Number(item.section) >= 0
            ? Number(item.section)
            : 0,
      }))
    : (Array.isArray(body.values) ? body.values : []).map((value) => ({
        id: undefined,
        value: value.trim(),
        section: 0,
      }));
  const values = layout.map((item) => item.value);
  const sectionCount =
    code === "client_status"
      ? 5
      : code === "payment" || code === "subitem_status"
        ? 4
        : code === "channel"
          ? 4
          : code === "mode_of_payment"
            ? 3
            : 1;
  if (
    !BOARD_OPTION_CODES.has(code) ||
    values.length === 0 ||
    new Set(layout.map((item) => item.id ?? `value:${item.value}`)).size !==
      layout.length ||
    layout.some((item) => item.section >= sectionCount)
  ) {
    return NextResponse.json(
      { error: "Invalid label order." },
      { status: 400 },
    );
  }

  const { data: group, error: groupError } = await supabaseAdmin
    .from("option_groups")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (groupError || !group)
    return NextResponse.json(
      { error: groupError?.message ?? "Label group was not found." },
      { status: 404 },
    );

  // The Board normally renders a synthetic blank label. Materialise it the
  // first time it is reordered so its position can be persisted like any
  // other label.
  if (values.includes("")) {
    const { data: blank } = await supabaseAdmin
      .from("option_values")
      .select("id")
      .eq("group_id", group.id)
      .eq("value", "")
      .maybeSingle();
    if (!blank) {
      const { error: blankError } = await supabaseAdmin
        .from("option_values")
        .insert({
          group_id: group.id,
          value: "",
          color: "#bfc0c2",
          sort_order: -1,
          section_index: 0,
        });
      if (blankError)
        return NextResponse.json(
          { error: blankError.message },
          { status: 500 },
        );
    }
  }

  const { data: options, error: optionsError } = await supabaseAdmin
    .from("option_values")
    .select("id, value, section_index")
    .eq("group_id", group.id)
    .order("section_index")
    .order("sort_order")
    .order("id");
  if (optionsError)
    return NextResponse.json({ error: optionsError.message }, { status: 500 });
  const optionById = new Map(
    (options ?? []).map((option) => [option.id, option]),
  );
  const optionByValue = new Map(
    (options ?? []).map((option) => [option.value, option]),
  );
  // A recently deleted/orphaned row can leave an already-open menu with a
  // stale option briefly. Persist every option that still exists instead of
  // rejecting the user's entire rearrangement with a 409. A later refresh
  // naturally removes the stale item from the client-side menu.
  const resolvedLayout = layout
    .map((item) => ({
      item,
      option: item.id ? optionById.get(item.id) : optionByValue.get(item.value),
    }))
    .filter(
      (
        entry,
      ): entry is {
        item: (typeof layout)[number];
        option: NonNullable<typeof entry.option>;
      } => Boolean(entry.option),
    );
  const seenOptionIds = new Set<string>();
  const validLayout = resolvedLayout.filter(({ option }) => {
    if (seenOptionIds.has(option.id)) return false;
    seenOptionIds.add(option.id);
    return true;
  });
  if (!validLayout.length) {
    return NextResponse.json(
      { error: "No current labels were available to reorder." },
      { status: 409 },
    );
  }

  // A concurrent label add/delete can make the stored list longer than the
  // menu snapshot. Preserve those unseen labels after the submitted layout.
  const submittedOptionIds = new Set(
    validLayout.map(({ option }) => option.id),
  );
  const storedOnlyOptions = (options ?? []).filter(
    (option) => !submittedOptionIds.has(option.id),
  );
  const completeLayout = [
    ...validLayout.map(({ item, option }) => ({
      id: option.id,
      section: item.section,
    })),
    ...storedOnlyOptions.map((option) => ({
      id: option.id,
      section: option.section_index ?? 0,
    })),
  ];

  const results = await Promise.all(
    completeLayout.map((item, sort_order) =>
      supabaseAdmin
        .from("option_values")
        .update({ sort_order, section_index: item.section })
        .eq("id", item.id),
    ),
  );
  const error = results.find((result) => result.error)?.error;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

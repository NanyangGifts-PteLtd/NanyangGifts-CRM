import { NextRequest, NextResponse } from "next/server";
import { AWARDED_OR_LATER_SUBITEM_STATUS_SYSTEM_KEYS } from "@/lib/board-labels";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const REPORT_ROLES = new Set(["director", "admin", "dev"]);
const SINGAPORE_TIME_ZONE = "Asia/Singapore";
const CLOSED_CLIENT_PAGE_SIZE = 500;

type TargetRow = {
  target_year: number;
  target_month: number;
  target_amount: number | string;
};

type ClosedClientRow = {
  id: string;
  display_id: string | null;
  name: string | null;
  channel: string | null;
  channel_option_id: string | null;
  custom_fields: Record<string, unknown> | null;
  tracking_invoice_numbers: string | null;
  group_id: string;
};

function failure(error: unknown) {
  const databaseError =
    error && typeof error === "object"
      ? (error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown })
      : null;
  const baseMessage =
    error instanceof Error
      ? error.message
      : typeof databaseError?.message === "string"
        ? databaseError.message
        : "Commission report request failed.";
  const diagnostic = [databaseError?.details, databaseError?.hint, databaseError?.code]
    .filter((value): value is string => typeof value === "string" && Boolean(value))
    .join(" — ");
  const message = diagnostic ? `${baseMessage}: ${diagnostic}` : baseMessage;
  return NextResponse.json(
    { error: message },
    {
      status:
        message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400,
    },
  );
}

async function authorised() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!REPORT_ROLES.has(String(profile?.role ?? "").toLowerCase())) {
    throw new Error("Forbidden");
  }
  return user;
}

function singaporeDateKey(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SINGAPORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function numeric(value: unknown) {
  const parsed = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim(),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function currencyRate(systemKey: string | null | undefined) {
  if (systemKey === "currency_sgd") return 1;
  if (systemKey === "currency_rmb") return 0.2;
  if (systemKey === "currency_myr") return 0.333;
  return 0;
}

function monetary(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function financials(
  subitem: Record<string, unknown>,
  currencyKeys: Map<string, string | null>,
) {
  const quantity = numeric(subitem.qty);
  const cost = numeric(subitem.cost);
  const rate = currencyRate(
    currencyKeys.get(String(subitem.currency_option_id ?? "")),
  );
  const totalCost =
    cost * rate * quantity +
    numeric(subitem.manpower) +
    numeric(subitem.ls) +
    numeric(subitem.os);
  const revenue = monetary(numeric(subitem.up) * quantity);
  return { revenue, markup: monetary(revenue - totalCost) };
}

function rangeFromRequest(value: unknown) {
  if (!value || typeof value !== "object")
    throw new Error("A report date range is required.");
  const candidate = value as { start?: unknown; end?: unknown };
  const start = String(candidate.start ?? "");
  const end = String(candidate.end ?? "");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    start > end
  ) {
    throw new Error("Choose a valid report date range.");
  }
  return { start, end };
}

async function metadata() {
  const [groupsResult, salesResult, targetsResult, authUsersResult] =
    await Promise.all([
    supabaseAdmin
      .from("crm_groups")
      .select("id, name")
      .ilike("name", "Closed Leads%")
      .order("name"),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, avatar_url, avatar_color")
      .ilike("role", "sales")
      .order("full_name"),
    supabaseAdmin
      .from("commission_monthly_targets")
      .select("target_year, target_month, target_amount")
      .order("target_year", { ascending: false })
      .order("target_month"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
  if (groupsResult.error) throw groupsResult.error;
  if (salesResult.error) throw salesResult.error;
  if (targetsResult.error) throw targetsResult.error;
  if (authUsersResult.error) throw authUsersResult.error;
  const suspendedUserIds = new Set(
    (authUsersResult.data.users ?? [])
      .filter((user) => user.app_metadata?.suspended === true)
      .map((user) => user.id),
  );
  const months = (groupsResult.data ?? [])
    .flatMap((group) => {
      const match = /^Closed Leads\s*-\s*([A-Za-z]+)\s+(\d{4})$/i.exec(
        group.name ?? "",
      );
      if (!match) return [];
      const month =
        new Date(`${match[1]} 1, ${match[2]} UTC`).getUTCMonth() + 1;
      return Number.isFinite(month)
        ? [
            {
              groupId: group.id,
              year: Number(match[2]),
              month,
            start: `${Number(match[2]) - (month === 1 ? 1 : 0)}-${String(month === 1 ? 12 : month - 1).padStart(2, "0")}-26`,
            end: `${Number(match[2])}-${String(month).padStart(2, "0")}-25`,
              label: group.name,
            },
          ]
        : [];
    })
    .sort((left, right) => right.year - left.year || right.month - left.month);
  return {
    months,
    salespeople: (salesResult.data ?? []).map((person) => ({
      ...person,
      isSuspended: suspendedUserIds.has(person.id),
    })),
    targets: targetsResult.data ?? [],
  };
}

export async function GET() {
  try {
    await authorised();
    return NextResponse.json(await metadata());
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authorised();
    const body = (await request.json()) as {
      year?: unknown;
      month?: unknown;
      amount?: unknown;
    };
    const year = Number(body.year);
    const month = Number(body.month);
    const amount = Number(body.amount);
    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 9999 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      throw new Error("Enter a valid non-negative monthly target.");
    }
    const { data, error } = await supabaseAdmin
      .from("commission_monthly_targets")
      .upsert(
        {
          target_year: year,
          target_month: month,
          target_amount: amount,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
          created_by: user.id,
        },
        { onConflict: "target_year,target_month" },
      )
      .select("target_year, target_month, target_amount")
      .single();
    if (error) throw error;
    return NextResponse.json({ target: data });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  let stage = "authorising the report request";
  try {
    await authorised();
    stage = "reading the report settings";
    const body = (await request.json()) as {
      range?: unknown;
      salespersonIds?: unknown;
      progressYear?: unknown;
    };
    const range = rangeFromRequest(body.range);
    const requestedSalespeople = Array.isArray(body.salespersonIds)
      ? new Set(
          body.salespersonIds.filter(
            (id): id is string => typeof id === "string",
          ),
        )
      : null;
    stage = "loading closed-lead metadata";
    const { months, salespeople, targets } = await metadata();
    const closedGroupIds = months.map((month) => month.groupId);
    if (!closedGroupIds.length)
      return NextResponse.json({
        range,
        salespeople: [],
        clients: [],
        summary: { markup: 0, closedLeads: 0 },
        progress: {
          year: Number(body.progressYear) || new Date().getFullYear(),
          monthlyTargets: [],
          yearlyTarget: 0,
          currentProgress: 0,
        },
      });

    stage = "loading closed clients and board labels";
    const { data: optionRowsData, error: optionsError } = await supabaseAdmin
      .from("option_values")
      .select("id, group_id, system_key, value");
    if (optionsError) throw optionsError;
    const closedClientRows: ClosedClientRow[] = [];
    for (let offset = 0; ; offset += CLOSED_CLIENT_PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from("clients")
        .select(
          "id, display_id, name, channel, channel_option_id, custom_fields, tracking_invoice_numbers, group_id",
        )
        .in("group_id", closedGroupIds)
        .is("deleted_at", null)
        .order("id")
        .range(offset, offset + CLOSED_CLIENT_PAGE_SIZE - 1);
      if (error) throw error;
      const page = data ?? [];
      closedClientRows.push(...(page as ClosedClientRow[]));
      if (page.length < CLOSED_CLIENT_PAGE_SIZE) break;
    }
    const optionRows = optionRowsData ?? [];
    const statusIds = new Set(
      optionRows
        .filter((option) =>
          AWARDED_OR_LATER_SUBITEM_STATUS_SYSTEM_KEYS.includes(
            option.system_key as (typeof AWARDED_OR_LATER_SUBITEM_STATUS_SYSTEM_KEYS)[number],
          ),
        )
        .map((option) => option.id),
    );
    const verifiedIds = new Set(
      optionRows
        .filter((option) =>
          [
            "subitem_status_verified",
            "subitem_status_variation_cost_difference",
          ].includes(option.system_key ?? ""),
        )
        .map((option) => option.id),
    );
    const currencyKeys = new Map(
      optionRows.map((option) => [option.id, option.system_key]),
    );
    const optionValues = new Map(
      optionRows.map((option) => [option.id, option.value]),
    );
    const eligibleClients = closedClientRows.filter((client) => {
      const date = singaporeDateKey(
        (client.custom_fields as Record<string, unknown> | null)?.closedDate,
      );
      return Boolean(date);
    });
    const clientIds = eligibleClients.map((client) => client.id);
    stage = "loading eligible subitems";
    const clientIdChunks = chunks(clientIds, 100);
    const subitemResults = await Promise.all(
      clientIdChunks.map((clientIdChunk) =>
        supabaseAdmin
          .from("subitems")
          .select(
            "id, client_id, display_id, name, status, status_option_id, qty, cost, manpower, ls, os, up, currency_option_id",
          )
          .in("client_id", clientIdChunk)
          .is("deleted_at", null),
      ),
    );
    const subitemsError = subitemResults.find((result) => result.error)?.error;
    if (subitemsError) throw subitemsError;
    const subitems = subitemResults.flatMap((result) => result.data ?? []);
    stage = "loading People Sales assignments";
    const assignmentResults = await Promise.all(
      clientIdChunks.map((clientIdChunk) =>
        supabaseAdmin
          .from("client_assignees")
          .select("client_id, user_id")
          .in("client_id", clientIdChunk)
          .eq("assignment_type", "people"),
      ),
    );
    const assignmentsError = assignmentResults.find((result) => result.error)?.error;
    if (assignmentsError) throw assignmentsError;
    const assignments = assignmentResults.flatMap((result) => result.data ?? []);
    const salesById = new Map(salespeople.map((person) => [person.id, person]));
    const assignedSalesByClient = new Map<string, string[]>();
    for (const assignment of assignments) {
      if (!salesById.has(assignment.user_id)) continue;
      const existing = assignedSalesByClient.get(assignment.client_id) ?? [];
      existing.push(assignment.user_id);
      assignedSalesByClient.set(assignment.client_id, existing);
    }
    const subitemsByClient = new Map<string, Array<Record<string, unknown>>>();
    for (const subitem of subitems) {
      if (!statusIds.has(String(subitem.status_option_id ?? ""))) continue;
      const items = subitemsByClient.get(subitem.client_id) ?? [];
      items.push(subitem);
      subitemsByClient.set(subitem.client_id, items);
    }
    const clients = eligibleClients.map((client) => {
      const closedDate = singaporeDateKey(
        (client.custom_fields as Record<string, unknown> | null)?.closedDate,
      );
      const eligibleSubitems = subitemsByClient.get(client.id) ?? [];
      const values = eligibleSubitems.map((subitem) => ({
        id: String(subitem.id),
        displayId: String(subitem.display_id ?? ""),
        name: String(subitem.name ?? ""),
        status: String(
          subitem.status ??
            optionValues.get(String(subitem.status_option_id ?? "")) ??
            "",
        ),
        statusOptionId: String(subitem.status_option_id ?? ""),
        ...financials(subitem, currencyKeys),
      }));
      return {
        id: client.id,
        displayId: client.display_id ?? "",
        name: client.name ?? "",
        channel:
          client.channel ??
          optionValues.get(String(client.channel_option_id ?? "")) ??
          "",
        closedDate,
        invoices: client.tracking_invoice_numbers ?? "",
        salespersonIds: assignedSalesByClient.get(client.id) ?? [],
        verified:
          values.length > 0 &&
          values.every((subitem) => verifiedIds.has(subitem.statusOptionId)),
        markup: monetary(
          values.reduce((sum, subitem) => sum + subitem.markup, 0),
        ),
        revenue: monetary(
          values.reduce((sum, subitem) => sum + subitem.revenue, 0),
        ),
        subitems: values,
      };
    }).sort(
      (left, right) =>
        left.closedDate.localeCompare(right.closedDate) ||
        left.name.localeCompare(right.name),
    );
    const inRange = clients.filter(
      (client) =>
        client.closedDate >= range.start && client.closedDate <= range.end,
    );
    const selectedSalespeople = salespeople.filter(
      (person) => !requestedSalespeople || requestedSalespeople.has(person.id),
    );
    const groupedSalespeople = selectedSalespeople.map((person) => ({
      ...person,
      clients: inRange.filter((client) =>
        client.salespersonIds.includes(person.id),
      ),
    }));
    const progressYear = Number.isInteger(Number(body.progressYear))
      ? Number(body.progressYear)
      : new Date().getFullYear();
    const progressStart = `${progressYear - 1}-12-26`;
    const today = singaporeDateKey(new Date());
    // A closed-month year ends on 25 December. Dates from 26 December belong
    // to the following January closed month and must not inflate this year's
    // tracker, even while the calendar year has not ended yet.
    const progressEnd =
      progressYear < new Date().getFullYear()
        ? `${progressYear}-12-25`
        : [today, `${progressYear}-12-25`].sort()[0];
    const progressClients = clients.filter(
      (client) =>
        client.closedDate >= progressStart && client.closedDate <= progressEnd,
    );
    const targetByMonth = new Map(
      (targets as TargetRow[])
        .filter((target) => Number(target.target_year) === progressYear)
        .map((target) => [
          Number(target.target_month),
          numeric(target.target_amount),
        ]),
    );
    const monthlyTargets = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      amount: targetByMonth.get(index + 1) ?? 0,
    }));
    return NextResponse.json({
      range,
      salespeople: groupedSalespeople,
      clients: inRange,
      summary: {
        markup: monetary(
          inRange.reduce((sum, client) => sum + client.markup, 0),
        ),
        closedLeads: inRange.length,
      },
      progress: {
        year: progressYear,
        monthlyTargets,
        yearlyTarget: monthlyTargets.reduce(
          (sum, target) => sum + target.amount,
          0,
        ),
        currentProgress: monetary(
          progressClients.reduce((sum, client) => sum + client.markup, 0),
        ),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Commission report request failed.";
    return failure(new Error(`${stage}: ${message}`));
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type GanttResourceRequest = {
  limit?: unknown;
  afterGroupSort?: unknown;
  afterClientCreatedAt?: unknown;
  afterClientId?: unknown;
  afterSubitemPosition?: unknown;
  afterSubitemId?: unknown;
  afterTimelineIndex?: unknown;
  search?: unknown;
  searchScope?: unknown;
  groupIds?: unknown;
  clientIds?: unknown;
  pmIds?: unknown;
  peopleIds?: unknown;
  processStatuses?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
};

const arrayOfStrings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : null;

const nullableString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const nullableNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Gantt resource discovery previously ran directly in the browser under the
 * caller's RLS context. The production dataset now makes that path prone to
 * statement timeouts before the small, paged result is returned. Authenticate
 * the request with the caller's session, then use the server database client
 * for this read-only, ID-only page lookup. Full client records remain loaded
 * through the normal authenticated hydration path in the browser.
 */
export async function POST(request: NextRequest) {
  const caller = await createClient();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: GanttResourceRequest;
  try {
    body = (await request.json()) as GanttResourceRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const limit = Math.max(1, Math.min(101, Math.trunc(nullableNumber(body.limit) ?? 31)));
  const { data, error } = await supabaseAdmin.rpc("gantt_resource_page", {
    p_limit: limit,
    p_after_group_sort: nullableNumber(body.afterGroupSort),
    p_after_client_created_at: nullableString(body.afterClientCreatedAt),
    p_after_client_id: nullableString(body.afterClientId),
    p_after_subitem_position: nullableNumber(body.afterSubitemPosition),
    p_after_subitem_id: nullableString(body.afterSubitemId),
    p_after_timeline_index: nullableNumber(body.afterTimelineIndex),
    p_search: nullableString(body.search),
    p_search_scope: nullableString(body.searchScope) ?? "all",
    p_group_ids: arrayOfStrings(body.groupIds),
    p_client_ids: arrayOfStrings(body.clientIds),
    p_pm_ids: arrayOfStrings(body.pmIds),
    p_people_ids: arrayOfStrings(body.peopleIds),
    p_process_statuses: arrayOfStrings(body.processStatuses),
    p_date_from: nullableString(body.dateFrom),
    p_date_to: nullableString(body.dateTo),
  });

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] });
}

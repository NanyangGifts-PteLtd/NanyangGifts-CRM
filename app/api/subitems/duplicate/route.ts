import { NextRequest, NextResponse } from "next/server";
import { canEditClient } from "@/lib/client-access";
import { duplicateSubitemValues } from "@/lib/subitem-duplication";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const createdSubitemIds: string[] = [];
  try {
    const { subitemIds } = await request.json() as { subitemIds?: string[] };
    if (
      !Array.isArray(subitemIds) ||
      !subitemIds.length ||
      !subitemIds.every((id) => typeof id === "string") ||
      new Set(subitemIds).size !== subitemIds.length
    ) {
      return NextResponse.json({ error: "Select one or more subitems to duplicate." }, { status: 400 });
    }

    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: sourceRows, error: sourceError } = await supabaseAdmin
      .from("subitems")
      .select("*")
      .in("id", subitemIds)
      .is("deleted_at", null);
    if (sourceError) throw sourceError;
    if ((sourceRows ?? []).length !== subitemIds.length) {
      return NextResponse.json({ error: "One or more selected subitems are no longer available." }, { status: 409 });
    }
    if (sourceRows?.some((row) => row.custom_fields?.additionalCostLinked === "true")) {
      return NextResponse.json({ error: "Additional Cost subitems cannot be duplicated." }, { status: 400 });
    }

    const sourceById = new Map((sourceRows ?? []).map((row) => [row.id, row]));
    const orderedSources = subitemIds.map((id) => sourceById.get(id)!);
    const sourcesByClient = new Map<string, typeof orderedSources>();
    for (const source of orderedSources) {
      const rows = sourcesByClient.get(source.client_id) ?? [];
      rows.push(source);
      sourcesByClient.set(source.client_id, rows);
    }

    const editable = await Promise.all(
      [...sourcesByClient.keys()].map(async (clientId) => [
        clientId,
        await canEditClient(session, clientId, user.id),
      ] as const),
    );
    if (editable.some(([, allowed]) => !allowed)) {
      return NextResponse.json({ error: "You can only duplicate subitems assigned to you." }, { status: 403 });
    }

    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const actorName = actorProfile?.full_name?.trim() || actorProfile?.email || user.email || "CRM user";
    const duplicatedRows: Record<string, unknown>[] = [];

    for (const [clientId, sources] of sourcesByClient) {
      const { data: siblings, error: siblingsError } = await supabaseAdmin
        .from("subitems")
        .select("id, position, created_at")
        .eq("client_id", clientId)
        .is("deleted_at", null)
        .order("position", { ascending: true });
      if (siblingsError) throw siblingsError;

      const nextPosition = Math.max(
        -1,
        ...(siblings ?? []).map((sibling) => Number(sibling.position ?? -1)),
      ) + 1;
      const copies = sources.map((source, index) => ({
        ...duplicateSubitemValues(source),
        // client_id is intentionally not part of the copied business values,
        // but a duplicate must remain under the same source client.
        client_id: clientId,
        created_by: user.id,
        position: nextPosition + index,
      }));
      const { data: copiesResult, error: copyError } = await supabaseAdmin
        .from("subitems")
        .insert(copies)
        .select("*");
      if (copyError || !copiesResult?.length) {
        throw copyError ?? new Error("Could not duplicate subitems");
      }
      createdSubitemIds.push(...copiesResult.map((row) => row.id));

      const duplicateByPosition = new Map(
        copiesResult.map((row) => [Number(row.position), row]),
      );
      const duplicateBySourceId = new Map(
        sources.map((source, index) => [source.id, duplicateByPosition.get(nextPosition + index)]),
      );
      if ([...duplicateBySourceId.values()].some((row) => !row)) {
        throw new Error("Could not match duplicated subitems to their source rows");
      }

      const { error: paymentRowsError } = await supabaseAdmin
        .from("subitem_payment_rows")
        .insert(
          copiesResult.map((row) => ({
            subitem_id: row.id,
            position: 0,
            amount: "",
            order_number: "",
            payment_received: null,
            payment_received_label: "",
            payment_received_option_id: null,
            mode_of_payment: "",
            mode_of_payment_option_id: null,
          })),
        );
      if (paymentRowsError) throw paymentRowsError;

      const copiesAfterSource = new Map(
        sources.map((source) => [source.id, duplicateBySourceId.get(source.id)!.id]),
      );
      const orderedSiblingIds = [...(siblings ?? [])]
        .sort((left, right) =>
          Number(left.position ?? Number.MAX_SAFE_INTEGER) - Number(right.position ?? Number.MAX_SAFE_INTEGER) ||
          String(left.created_at ?? "").localeCompare(String(right.created_at ?? "")),
        )
        .flatMap((sibling) => [
          sibling.id,
          ...(copiesAfterSource.has(sibling.id) ? [copiesAfterSource.get(sibling.id)!] : []),
        ]);
      const { error: reorderError } = await supabaseAdmin.rpc("crm_reorder_subitems_v1", {
        p_client_id: clientId,
        p_ordered_subitem_ids: orderedSiblingIds,
      });
      if (reorderError) throw reorderError;
      duplicatedRows.push(...copiesResult);
    }

    const { error: activityError } = await supabaseAdmin.from("activity_log").insert(
      duplicatedRows.map((row) => ({
        client_id: row.client_id,
        subitem_id: row.id,
        subitem_name: row.name,
        actor_name: actorName,
        action: "subitem_added",
        title: "duplicated this subitem",
        field_name: null,
        old_value: null,
        new_value: null,
        link: null,
        description: null,
        meta: null,
        created_at: new Date().toISOString(),
      })),
    );
    if (activityError) throw activityError;

    return NextResponse.json({ subitems: duplicatedRows });
  } catch (error) {
    if (createdSubitemIds.length) {
      await supabaseAdmin.from("subitem_assignees").delete().in("subitem_id", createdSubitemIds);
      await supabaseAdmin.from("subitem_payment_rows").delete().in("subitem_id", createdSubitemIds);
      await supabaseAdmin.from("subitems").delete().in("id", createdSubitemIds);
    }
    console.error("Subitem duplication failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not duplicate subitems" },
      { status: 500 },
    );
  }
}

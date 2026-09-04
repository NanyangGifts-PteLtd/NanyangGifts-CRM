import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);
const PRIVILEGED_ROLES = new Set(["admin", "director", "dev"]);

function duplicateValues(row: Record<string, unknown>, omit: string[]) {
  const copy = { ...row };
  for (const key of omit) delete copy[key];
  return copy;
}

async function removeIncompleteDuplicate(clientId: string) {
  // This is compensating cleanup for any failure after the client row has
  // been inserted. The endpoint never leaves a partial duplicate behind.
  const { data: subitems } = await supabaseAdmin
    .from("subitems")
    .select("id")
    .eq("client_id", clientId);
  if (subitems?.length) {
    await supabaseAdmin
      .from("subitem_assignees")
      .delete()
      .in("subitem_id", subitems.map((subitem) => subitem.id));
  }
  await supabaseAdmin.from("subitems").delete().eq("client_id", clientId);
  await supabaseAdmin.from("client_assignees").delete().eq("client_id", clientId);
  await supabaseAdmin.from("activity_log").delete().eq("client_id", clientId);
  await supabaseAdmin.from("clients").delete().eq("id", clientId);
}

export async function POST(request: NextRequest) {
  let duplicateId: string | null = null;

  try {
    const { clientId } = await request.json();
    if (!clientId || typeof clientId !== "string") {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }

    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [{ data: profile, error: profileError }, { data: assignment, error: assignmentError }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("full_name, email, role")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("client_assignees")
          .select("client_id")
          .eq("client_id", clientId)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
    if (profileError || assignmentError) throw profileError ?? assignmentError;

    const role = String(profile?.role ?? "").toLowerCase();
    if (!INTERNAL_ROLES.has(role) || (!PRIVILEGED_ROLES.has(role) && !assignment)) {
      return NextResponse.json({ error: "You can only duplicate clients assigned to you." }, { status: 403 });
    }

    const [sourceClientResult, sourceSubitemsResult, clientAssigneesResult] = await Promise.all([
      supabaseAdmin.from("clients").select("*").eq("id", clientId).maybeSingle(),
      supabaseAdmin.from("subitems").select("*").eq("client_id", clientId).order("position"),
      supabaseAdmin
        .from("client_assignees")
        .select("user_id, assignment_type")
        .eq("client_id", clientId),
    ]);
    if (sourceClientResult.error) throw sourceClientResult.error;
    if (!sourceClientResult.data) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    if (sourceSubitemsResult.error) throw sourceSubitemsResult.error;
    if (clientAssigneesResult.error) throw clientAssigneesResult.error;

    const clientCopy = duplicateValues(sourceClientResult.data, [
      "id",
      "created_at",
      "updated_at",
      "created_by",
      "updated_by",
      "waiting_started_at",
      "activity_log",
      "deletion_owner_id",
    ]);
    const { data: duplicate, error: duplicateError } = await supabaseAdmin
      .from("clients")
      .insert({
        ...clientCopy,
        name: `${sourceClientResult.data.name ?? "New Client"} (Copy)`,
        activity_log: [],
      })
      .select("id, name")
      .single();
    if (duplicateError || !duplicate) throw duplicateError ?? new Error("Could not create duplicate client");
    duplicateId = duplicate.id;

    // Make the actor an owner before copying child records. This is intentional
    // even when the source client was assigned only to other colleagues.
    const copiedAssignments = new Map<string, { client_id: string; user_id: string; assignment_type: string; assigned_by: string }>();
    for (const assignee of clientAssigneesResult.data ?? []) {
      const assignmentType = assignee.assignment_type === "pm" ? "pm" : "people";
      copiedAssignments.set(`${assignee.user_id}:${assignmentType}`, {
        client_id: duplicate.id,
        user_id: assignee.user_id,
        assignment_type: assignmentType,
        assigned_by: user.id,
      });
    }
    copiedAssignments.set(`${user.id}:people`, {
      client_id: duplicate.id,
      user_id: user.id,
      assignment_type: "people",
      assigned_by: user.id,
    });
    const { error: assignmentInsertError } = await supabaseAdmin
      .from("client_assignees")
      .insert([...copiedAssignments.values()]);
    if (assignmentInsertError) throw assignmentInsertError;

    for (const sourceSubitem of sourceSubitemsResult.data ?? []) {
      const subitemCopy = duplicateValues(sourceSubitem, [
        "id",
        "client_id",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
        "waiting_started_at",
        "deletion_owner_id",
      ]);
      const timelineRows = Array.isArray(subitemCopy.timeline_rows)
        ? subitemCopy.timeline_rows.map((row: Record<string, unknown>) => ({
            ...row,
            id: crypto.randomUUID(),
          }))
        : [];
      const { data: duplicateSubitem, error: subitemInsertError } = await supabaseAdmin
        .from("subitems")
        .insert({ ...subitemCopy, client_id: duplicate.id, timeline_rows: timelineRows })
        .select("id")
        .single();
      if (subitemInsertError || !duplicateSubitem) {
        throw subitemInsertError ?? new Error("Could not copy subitem");
      }

      const { data: sourceAssignees, error: sourceAssigneesError } = await supabaseAdmin
        .from("subitem_assignees")
        .select("user_id")
        .eq("subitem_id", sourceSubitem.id);
      if (sourceAssigneesError) throw sourceAssigneesError;
      if (sourceAssignees?.length) {
        const { error: subitemAssigneeInsertError } = await supabaseAdmin
          .from("subitem_assignees")
          .insert(
            sourceAssignees.map((assignee) => ({
              subitem_id: duplicateSubitem.id,
              user_id: assignee.user_id,
              assigned_by: user.id,
            })),
          );
        if (subitemAssigneeInsertError) throw subitemAssigneeInsertError;
      }
    }

    const actorName = profile?.full_name?.trim() || profile?.email || user.email || "CRM user";
    const { error: activityError } = await supabaseAdmin.from("activity_log").insert({
      client_id: duplicate.id,
      subitem_id: null,
      actor_name: actorName,
      action: "client_added",
      field_name: null,
      old_value: null,
      new_value: null,
      subitem_name: null,
      link: null,
      title: "duplicated this client",
      description: null,
      meta: { sourceClientId: clientId },
      created_at: new Date().toISOString(),
    });
    if (activityError) throw activityError;

    return NextResponse.json({ client: duplicate });
  } catch (error) {
    if (duplicateId) await removeIncompleteDuplicate(duplicateId);
    console.error("Client duplication failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not duplicate client" },
      { status: 500 },
    );
  }
}

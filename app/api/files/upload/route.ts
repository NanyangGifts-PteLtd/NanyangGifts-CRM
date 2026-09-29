import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  assertSupabaseAdminConfiguration,
  supabaseAdmin,
} from "@/lib/supabase/admin";

const BUCKET = "crm-files";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);
const ELEVATED_ROLES = new Set(["admin", "director", "dev"]);

function safeSegment(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "file"
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    assertSupabaseAdminConfiguration();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Server configuration error.",
      },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const scope = String(formData.get("scope") ?? "uploads");
  const clientId = String(formData.get("clientId") ?? "").trim();
  const subitemId = String(formData.get("subitemId") ?? "").trim();
  if (!(file instanceof File))
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  const billOnlyUpload =
    scope === "quickbooks-bills-only" && clientId === "quickbooks-bills-only";
  if (!clientId)
    return NextResponse.json(
      { error: "A linked client is required" },
      { status: 400 },
    );
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = String(profile?.role ?? "")
    .trim()
    .toLowerCase();
  if (profileError || !INTERNAL_ROLES.has(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (billOnlyUpload) {
    if (!ELEVATED_ROLES.has(role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (!ELEVATED_ROLES.has(role)) {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!client)
      return NextResponse.json(
        { error: "The linked client is unavailable" },
        { status: 404 },
      );

    const { data: clientAssignment, error: clientAssignmentError } =
      await supabaseAdmin
        .from("client_assignees")
        .select("client_id")
        .eq("client_id", clientId)
        .eq("user_id", user.id)
        .in("assignment_type", ["people", "pm"])
        .maybeSingle();
    if (clientAssignmentError)
      return NextResponse.json(
        { error: clientAssignmentError.message },
        { status: 500 },
      );

    let hasSubitemAssignment = false;
    if (!clientAssignment && subitemId) {
      const { data: subitem } = await supabaseAdmin
        .from("subitems")
        .select("id")
        .eq("id", subitemId)
        .eq("client_id", clientId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!subitem)
        return NextResponse.json(
          { error: "The linked subitem is unavailable" },
          { status: 404 },
        );
      const { data: subitemAssignment, error: subitemAssignmentError } =
        await supabaseAdmin
          .from("subitem_assignees")
          .select("subitem_id")
          .eq("subitem_id", subitemId)
          .eq("user_id", user.id)
          .maybeSingle();
      if (subitemAssignmentError)
        return NextResponse.json(
          { error: subitemAssignmentError.message },
          { status: 500 },
        );
      hasSubitemAssignment = Boolean(subitemAssignment);
    }
    if (!clientAssignment && !hasSubitemAssignment)
      return NextResponse.json(
        {
          error:
            "You can only upload files for clients or subitems assigned to you",
        },
        { status: 403 },
      );
  }
  if (!file.size)
    return NextResponse.json(
      { error: "The selected file is empty" },
      { status: 400 },
    );
  if (file.size > MAX_FILE_SIZE)
    return NextResponse.json(
      { error: "Files must be 25 MB or smaller" },
      { status: 400 },
    );

  const extension = safeSegment(file.name.split(".").pop() || "bin");
  const cleanScope = scope
    .split("/")
    .map(safeSegment)
    .filter(Boolean)
    .slice(0, 5)
    .join("/");
  const storagePath = billOnlyUpload
    ? `quickbooks-bills-only/${user.id}/${randomUUID()}.${extension}`
    : subitemId
      ? `subitems/${clientId}/${subitemId}/${cleanScope}/${user.id}/${randomUUID()}.${extension}`
      : `clients/${clientId}/${cleanScope}/${user.id}/${randomUUID()}.${extension}`;
  // Storage RLS cannot express every authorised CRM workflow consistently.
  // The user and target have been checked above, so this server-only write
  // intentionally uses the service role rather than the browser session.
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    file: {
      id: randomUUID(),
      name: file.name,
      mimeType: file.type || undefined,
      storagePath,
      url: `/api/files/download?path=${encodeURIComponent(storagePath)}`,
    },
  });
}

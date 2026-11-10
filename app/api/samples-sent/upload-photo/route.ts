import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "crm-files";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);
const PRIVILEGED_ROLES = new Set(["admin", "director", "dev"]);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = String(profile?.role ?? "").toLowerCase();
    if (!INTERNAL_ROLES.has(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const formData = await request.formData();
    const recordId = String(formData.get("recordId") ?? "").trim();
    const file = formData.get("file");
    if (!recordId || !(file instanceof File))
      return NextResponse.json({ error: "A Samples Sent record and photo are required" }, { status: 400 });
    if (!file.type.startsWith("image/"))
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    if (!file.size || file.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: "Photos must be 10 MB or smaller" }, { status: 400 });

    const { data: record, error: recordError } = await supabaseAdmin
      .from("samples_sent")
      .select("id, client_id, deactivated_at")
      .eq("id", recordId)
      .maybeSingle();
    if (recordError || !record) return NextResponse.json({ error: "Samples Sent record not found" }, { status: 404 });
    if (record.deactivated_at) return NextResponse.json({ error: "A deactivated Samples Sent record cannot be edited" }, { status: 400 });
    if (record.client_id && !PRIVILEGED_ROLES.has(role)) {
      const { data: assignment } = await supabaseAdmin
        .from("client_assignees")
        .select("client_id")
        .eq("client_id", record.client_id)
        .eq("user_id", user.id)
        .in("assignment_type", ["people", "pm"])
        .maybeSingle();
      if (!assignment) return NextResponse.json({ error: "You can only edit Samples Sent records for clients assigned to you" }, { status: 403 });
    }

    const extension = (file.name.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "");
    const storagePath = `samples-sent/${recordId}/photos/${user.id}/${randomUUID()}.${extension || "bin"}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(
      storagePath,
      Buffer.from(await file.arrayBuffer()),
      { contentType: file.type, upsert: false },
    );
    if (uploadError) throw uploadError;
    return NextResponse.json({ file: {
      id: randomUUID(), name: file.name, mimeType: file.type,
      storagePath, url: `/api/files/download?path=${encodeURIComponent(storagePath)}`,
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Photo upload failed" }, { status: 500 });
  }
}

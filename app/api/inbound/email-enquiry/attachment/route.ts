import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "crm-files";
const MAX_FILE_SIZE = 3_500_000;

type StoredAttachment = {
  id: string;
  kind: "file";
  name: string;
  url: string;
  mimeType?: string;
  storagePath: string;
  actorName: string;
  createdAt: string;
  createdThrough: string;
  sourceKey: string;
};

function configuredSecret() {
  return process.env.MAKE_INBOUND_SECRET?.trim() || process.env.MAKE_INTEGRATION_SECRET?.trim() || "";
}

function authorized(request: NextRequest) {
  const expected = configuredSecret();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return Boolean(expected) && left.length === right.length && timingSafeEqual(left, right);
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "file";
}

function existingAttachments(value: unknown): StoredAttachment[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is StoredAttachment => Boolean(item && typeof item === "object")) : [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  if (!configuredSecret()) {
    return NextResponse.json({ error: "Make inbound secret is not configured." }, { status: 500 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const clientId = String(formData.get("clientId") ?? "").trim();
    const externalId = String(formData.get("externalId") ?? formData.get("messageId") ?? "").trim();
    const attachmentId = String(formData.get("attachmentId") ?? "").trim();
    const file = formData.get("file");
    if (!clientId || !externalId || !(file instanceof File)) {
      return NextResponse.json({ error: "clientId, externalId/messageId, and file are required." }, { status: 400 });
    }
    if (!file.size) return NextResponse.json({ error: "The attachment is empty." }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Email attachments must be 3.5 MB or smaller." }, { status: 413 });
    }

    const { data: ingestion, error: ingestionError } = await supabaseAdmin
      .from("lead_ingestions")
      .select("client_id")
      .eq("source", "email")
      .eq("external_id", externalId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (ingestionError) throw ingestionError;
    if (!ingestion) return NextResponse.json({ error: "Matching email ingestion was not found." }, { status: 404 });

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("custom_fields")
      .eq("id", clientId)
      .single();
    if (clientError) throw clientError;
    const customFields = client.custom_fields && typeof client.custom_fields === "object" && !Array.isArray(client.custom_fields)
      ? client.custom_fields as Record<string, unknown>
      : {};
    const attachments = existingAttachments(customFields.logoRequirementsFile);
    const sourceKey = `email:${externalId}:${attachmentId || `${file.name}:${file.size}`}`;
    const duplicate = attachments.find((item) => item.sourceKey === sourceKey);
    if (duplicate) return NextResponse.json({ ok: true, duplicate: true, file: duplicate });

    const extension = safeSegment(file.name.split(".").pop() || "bin");
    const storagePath = `clients/${clientId}/logoRequirementsFile/make-email/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(
      storagePath,
      Buffer.from(await file.arrayBuffer()),
      { contentType: file.type || "application/octet-stream", upsert: false },
    );
    if (uploadError) throw uploadError;

    const createdAt = new Date().toISOString();
    const stored: StoredAttachment = {
      id: randomUUID(),
      kind: "file",
      name: file.name,
      url: `/api/files/download?path=${encodeURIComponent(storagePath)}`,
      mimeType: file.type || undefined,
      storagePath,
      actorName: "Email integration (Make)",
      createdAt,
      createdThrough: "Received from enquiry email through Make",
      sourceKey,
    };
    const { error: updateError } = await supabaseAdmin
      .from("clients")
      .update({ custom_fields: { ...customFields, logoRequirementsFile: JSON.stringify([...attachments, stored]) } })
      .eq("id", clientId);
    if (updateError) {
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      throw updateError;
    }

    const { error: activityError } = await supabaseAdmin.from("activity_log").insert({
      client_id: clientId,
      subitem_id: null,
      actor_name: "Email integration (Make)",
      action: "file_uploaded",
      field_name: "logoRequirementsFile",
      old_value: null,
      new_value: file.name,
      subitem_name: null,
      link: stored.url,
      title: `uploaded ${file.name} from the enquiry email`,
      description: null,
      meta: { field: "logoRequirementsFile", fileName: file.name, storagePath, externalId, attachmentId: attachmentId || null, sourceKey },
      created_at: createdAt,
    });
    if (activityError) throw activityError;

    return NextResponse.json({ ok: true, duplicate: false, file: stored });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Attachment upload failed." }, { status: 500 });
  }
}

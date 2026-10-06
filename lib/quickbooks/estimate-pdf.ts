import { randomUUID } from "node:crypto";
import { qboDownload } from "@/lib/quickbooks/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

type StoredFile = {
  id: string;
  name: string;
  url: string;
  storagePath: string;
  mimeType: string;
};

function readFiles(value: unknown): StoredFile[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (file): file is StoredFile =>
            Boolean(file && typeof file === "object" && typeof file.url === "string"),
        )
      : [];
  } catch {
    return [];
  }
}

function filenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "quote";
}

/**
 * Archives the current QuickBooks-rendered quote in the client's Files area.
 * Each generation/update receives its own immutable PDF copy.
 */
export async function archiveQuickBooksEstimatePdf({
  clientId,
  estimateId,
  docNumber,
  actorName,
}: {
  clientId: string;
  estimateId: string;
  docNumber?: string | null;
  actorName: string;
}) {
  const quoteId = String(estimateId ?? "").trim();
  if (!quoteId) throw new Error("QuickBooks did not return a quote ID for PDF export.");

  const { bytes, contentType } = await qboDownload(
    `/estimate/${encodeURIComponent(quoteId)}/pdf`,
  );
  if (!bytes.length) throw new Error("QuickBooks returned an empty quote PDF.");

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("custom_fields")
    .eq("id", clientId)
    .is("deleted_at", null)
    .single();
  if (clientError || !client) throw clientError ?? new Error("Client not found.");

  const quotedNumber = String(docNumber ?? quoteId).trim();
  const createdAt = new Date();
  const attachment: StoredFile = {
    id: randomUUID(),
    name: `QuickBooks Quote ${quotedNumber}.pdf`,
    mimeType: "application/pdf",
    storagePath: `clients/${clientId}/quickbooks-quotes/${createdAt.toISOString().replace(/[:.]/g, "-")}-${filenamePart(quotedNumber)}-${randomUUID()}.pdf`,
    url: "",
  };
  attachment.url = `/api/files/download?path=${encodeURIComponent(attachment.storagePath)}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("crm-files")
    .upload(attachment.storagePath, bytes, {
      contentType: contentType.includes("pdf") ? "application/pdf" : contentType,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const customFields =
    client.custom_fields && typeof client.custom_fields === "object"
      ? client.custom_fields
      : {};
  const files = readFiles(customFields.filesMiscellaneous);
  const { error: updateError } = await supabaseAdmin
    .from("clients")
    .update({
      custom_fields: {
        ...customFields,
        filesMiscellaneous: JSON.stringify([...files, attachment]),
      },
      updated_at: createdAt.toISOString(),
    })
    .eq("id", clientId);
  if (updateError) {
    await supabaseAdmin.storage.from("crm-files").remove([attachment.storagePath]);
    throw updateError;
  }

  const { error: activityError } = await supabaseAdmin.from("activity_log").insert({
    client_id: clientId,
    subitem_id: null,
    actor_name: actorName,
    action: "file_uploaded",
    field_name: "filesMiscellaneous",
    old_value: null,
    new_value: null,
    subitem_name: null,
    link: attachment.url,
    title: `saved ${attachment.name}`,
    description: "QuickBooks quote PDF",
    meta: {
      field: "filesMiscellaneous",
      fileName: attachment.name,
      storagePath: attachment.storagePath,
      quickbooksEstimateId: quoteId,
      quickbooksEstimateDocNumber: quotedNumber,
    },
    created_at: createdAt.toISOString(),
  });
  if (activityError) console.error("Could not log QuickBooks quote PDF upload", activityError);

  return attachment;
}

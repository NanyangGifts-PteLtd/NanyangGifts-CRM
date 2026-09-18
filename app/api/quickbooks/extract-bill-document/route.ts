import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);
const MAX_FILE_BYTES = 4 * 1024 * 1024; // Azure F0 limit for the pilot.
const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/bmp",
  "image/heif",
]);

type AzureField = {
  content?: string;
  confidence?: number;
  valueString?: string;
  valueDate?: string;
  valueNumber?: number;
  valueCurrency?: { amount?: number; currencyCode?: string };
  valueArray?: Array<{ valueObject?: Record<string, AzureField> }>;
};

const valueOf = (field?: AzureField) =>
  field?.valueCurrency?.amount ?? field?.valueDate ?? field?.valueNumber ?? field?.valueString ?? field?.content ?? "";
const confidenceOf = (field?: AzureField) => field?.confidence ?? 0;

function normalise(document: any) {
  const fields = (document?.fields ?? {}) as Record<string, AzureField>;
  const itemFields = fields.Items?.valueArray ?? [];
  return {
    supplierName: String(valueOf(fields.VendorName) ?? ""),
    mailingAddress: String(valueOf(fields.VendorAddress) ?? ""),
    invoiceNumber: String(valueOf(fields.InvoiceId) ?? ""),
    billDate: String(valueOf(fields.InvoiceDate) ?? ""),
    dueDate: String(valueOf(fields.DueDate) ?? ""),
    total: Number(valueOf(fields.InvoiceTotal) ?? 0) || null,
    currency: fields.InvoiceTotal?.valueCurrency?.currencyCode ?? "",
    confidence: {
      supplierName: confidenceOf(fields.VendorName),
      mailingAddress: confidenceOf(fields.VendorAddress),
      invoiceNumber: confidenceOf(fields.InvoiceId),
      billDate: confidenceOf(fields.InvoiceDate),
      dueDate: confidenceOf(fields.DueDate),
      total: confidenceOf(fields.InvoiceTotal),
    },
    lines: itemFields.map(({ valueObject }) => {
      const item = valueObject ?? {};
      return {
        description: String(valueOf(item.Description) ?? valueOf(item.ProductCode) ?? ""),
        amount: Number(valueOf(item.Amount) ?? 0) || null,
        tax: String(valueOf(item.Tax) ?? ""),
        confidence: Math.min(
          confidenceOf(item.Description) || 1,
          confidenceOf(item.Amount) || 1,
        ),
      };
    }).filter((line: { description: string; amount: number | null }) => line.description || line.amount !== null),
  };
}

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!INTERNAL_ROLES.has(String(profile?.role ?? "").toLowerCase())) throw new Error("Forbidden");
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.replace(/\/$/, "");
    const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
    if (!endpoint || !key) throw new Error("Azure Document Intelligence is not configured.");
    const formData = await request.formData();
    const clientId = String(formData.get("clientId") ?? "").trim() || null;
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose a receipt or invoice file.");
    if (!ACCEPTED_TYPES.has(file.type)) throw new Error("Use a PDF, JPEG, PNG, TIFF, BMP, or HEIF receipt.");
    if (!file.size || file.size > MAX_FILE_BYTES) throw new Error("The Azure free tier accepts files up to 4 MB.");

    const start = await fetch(
      `${endpoint}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30`,
      {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": file.type },
        body: await file.arrayBuffer(),
      },
    );
    if (!start.ok) throw new Error(`Azure extraction could not start: ${await start.text()}`);
    const operationUrl = start.headers.get("operation-location");
    if (!operationUrl) throw new Error("Azure did not return an extraction operation URL.");

    let result: any;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await wait(750);
      const poll = await fetch(operationUrl, {
        headers: { "Ocp-Apim-Subscription-Key": key },
      });
      if (!poll.ok) throw new Error(`Azure extraction could not be read: ${await poll.text()}`);
      result = await poll.json();
      if (result.status === "succeeded") break;
      if (result.status === "failed") throw new Error("Azure could not extract information from this document.");
    }
    if (result?.status !== "succeeded") throw new Error("Document extraction timed out. Please try again.");
    const document = result.analyzeResult?.documents?.[0];
    const extraction = normalise(document);
    const { data: audit } = await supabaseAdmin
      .from("bill_document_extractions")
      .insert({
        created_by: user.id,
        client_id: clientId,
        source_filename: file.name,
        source_mime_type: file.type,
        source_size_bytes: file.size,
        extraction,
        raw_response: result,
      })
      .select("id")
      .single();
    return NextResponse.json({ extraction, extractionId: audit?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document extraction failed.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400 });
  }
}

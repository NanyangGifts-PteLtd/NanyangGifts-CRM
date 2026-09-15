import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { asText, ingestLead } from "@/lib/inbound-leads";

const INTERNAL_ROLES = new Set(["sales", "pm", "admin", "director", "dev"]);
const REVIEWER_ROLES = new Set(["admin", "director", "dev"]);

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = String(profile?.role ?? "")
    .trim()
    .toLowerCase();
  if (error || !INTERNAL_ROLES.has(role)) throw new Error("Forbidden");
  return { user, role };
}

function failure(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Email review request failed.";
  return NextResponse.json(
    { error: message },
    {
      status:
        message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400,
    },
  );
}

type QueuePayload = {
  clientName?: string;
  clientEmail?: string;
  subject?: string;
  body?: string;
  bodyText?: string;
};

function requirements(subject: string, body: string) {
  return [subject ? `Subject: ${subject}` : "", body]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 200_000);
}

export async function GET() {
  try {
    const { role } = await authorize();
    const { data, error } = await supabaseAdmin
      .from("email_review_queue")
      .select(
        "id, external_id, sender_name, sender_email, subject, body_text, email_type, review_status, reviewed_by, reviewed_at, promoted_client_id, promotion_error, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({
      rows: data ?? [],
      canReview: REVIEWER_ROLES.has(role),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, role } = await authorize();
    if (!REVIEWER_ROLES.has(role)) throw new Error("Forbidden");
    const body = (await request.json()) as {
      id?: string;
      action?: "promote" | "mark-reviewed";
    };
    if (!body.id || !body.action)
      throw new Error("An email and review action are required.");
    const { data: row, error: rowError } = await supabaseAdmin
      .from("email_review_queue")
      .select("*")
      .eq("id", body.id)
      .maybeSingle();
    if (rowError || !row) throw new Error("Email review record not found.");
    if (row.review_status === "promoted")
      throw new Error("This email has already been promoted to an enquiry.");
    if (!["pending", "failed"].includes(row.review_status)) {
      throw new Error("This email has already been reviewed.");
    }

    if (body.action === "mark-reviewed") {
      const { data, error } = await supabaseAdmin
        .from("email_review_queue")
        .update({
          review_status: "reviewed",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ row: data });
    }

    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("email_review_queue")
      .update({
        review_status: "promoting",
        promotion_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .in("review_status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) throw new Error("This email is already being reviewed.");

    try {
      const payload = (row.payload ?? {}) as QueuePayload;
      const result = await ingestLead({
        source: "email",
        submissionType: "email_enquiry",
        externalId: row.external_id,
        customerName: asText(payload.clientName || row.sender_name),
        companyName: "",
        email: asText(payload.clientEmail || row.sender_email).toLowerCase(),
        phone: "",
        notes: requirements(
          asText(payload.subject || row.subject),
          asText(payload.bodyText || payload.body || row.body_text),
        ),
        nbd: "",
        channel: "Email",
        orderNumber: "",
        currency: "SGD",
        orderTotal: "",
        billingAddress: "",
        qty: "",
        subitems: [],
      });
      const { data: ingestion, error: ingestionError } = await supabaseAdmin
        .from("lead_ingestions")
        .select("id, client_id")
        .eq("source", "email")
        .eq("external_id", row.external_id)
        .maybeSingle();
      if (ingestionError) throw ingestionError;
      const { data, error } = await supabaseAdmin
        .from("email_review_queue")
        .update({
          review_status: "promoted",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          promoted_ingestion_id: ingestion?.id ?? null,
          promoted_client_id: result.clientId ?? ingestion?.client_id ?? null,
          promotion_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({
        row: data,
        clientId: result.clientId ?? ingestion?.client_id ?? null,
      });
    } catch (promotionError) {
      const message =
        promotionError instanceof Error
          ? promotionError.message
          : "Promotion failed.";
      await supabaseAdmin
        .from("email_review_queue")
        .update({
          review_status: "failed",
          promotion_error: message.slice(0, 2_000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      throw promotionError;
    }
  } catch (error) {
    return failure(error);
  }
}

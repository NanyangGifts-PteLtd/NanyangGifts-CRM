import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { asText, ingestLead, InboundLeadError } from "@/lib/inbound-leads";
import { supabaseAdmin } from "@/lib/supabase/admin";

type IncomingEmailLead = {
  externalId?: string;
  messageId?: string;
  clientName?: string;
  clientEmail?: string;
  subject?: string;
  body?: string;
  bodyText?: string;
  emailType?: string;
};

function configuredSecret() {
  return (
    process.env.MAKE_INBOUND_SECRET?.trim() ||
    process.env.MAKE_INTEGRATION_SECRET?.trim() ||
    ""
  );
}

function authorized(request: NextRequest) {
  const expected = configuredSecret();
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return (
    Boolean(expected) &&
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
}

function requirementsFromEmail(subject: string, body: string) {
  return [subject ? `Subject: ${subject}` : "", body]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 200_000);
}

export async function POST(request: NextRequest) {
  if (!configuredSecret()) {
    return NextResponse.json(
      { error: "Make inbound secret is not configured." },
      { status: 500 },
    );
  }
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) {
    return NextResponse.json(
      { error: "Email lead payload is too large." },
      { status: 413 },
    );
  }

  try {
    const body = (await request.json()) as IncomingEmailLead;
    const messageId = asText(body.externalId || body.messageId);
    if (!messageId) {
      throw new InboundLeadError("Missing externalId or messageId.", 400);
    }
    const clientName = asText(body.clientName);
    const clientEmail = asText(body.clientEmail).toLowerCase();
    const subject = asText(body.subject);
    const messageBody = asText(body.bodyText || body.body);
    const emailType = asText(body.emailType || "ENQUIRY").toUpperCase();
    if (emailType !== "ENQUIRY" && emailType !== "NON-ENQUIRY") {
      throw new InboundLeadError(
        "emailType must be either ENQUIRY or NON-ENQUIRY.",
        400,
      );
    }
    if (emailType === "NON-ENQUIRY") {
      const { data: queued, error: queueError } = await supabaseAdmin
        .from("email_review_queue")
        .upsert(
          {
            external_id: messageId,
            sender_name: clientName,
            sender_email: clientEmail,
            subject,
            body_text: messageBody,
            email_type: emailType,
            payload: {
              clientName,
              clientEmail,
              subject,
              bodyText: messageBody,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "external_id", ignoreDuplicates: true },
        )
        .select("id, review_status")
        .maybeSingle();
      if (queueError) throw queueError;
      const reviewId =
        queued?.id ??
        (
          await supabaseAdmin
            .from("email_review_queue")
            .select("id")
            .eq("external_id", messageId)
            .maybeSingle()
        ).data?.id ??
        null;
      return NextResponse.json(
        {
          ok: true,
          queued: true,
          emailType,
          reviewId,
          attachmentUploadUrl: "/api/inbound/email-enquiry/attachment",
          message: "Non-enquiry email queued for review.",
        },
        { status: 202 },
      );
    }
    const result = await ingestLead({
      source: "email",
      submissionType: "email_enquiry",
      externalId: messageId,
      customerName: clientName,
      companyName: "",
      email: clientEmail,
      phone: "",
      notes: requirementsFromEmail(subject, messageBody),
      nbd: "",
      channel: "Email",
      orderNumber: "",
      currency: "SGD",
      orderTotal: "",
      billingAddress: "",
      qty: "",
      subitems: [],
    });
    return NextResponse.json(
      {
        ...result,
        source: "email",
        attachmentUploadUrl: "/api/inbound/email-enquiry/attachment",
      },
      { status: result.statusCode },
    );
  } catch (error) {
    const status = error instanceof InboundLeadError ? error.statusCode : 400;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid email lead request.",
      },
      { status },
    );
  }
}

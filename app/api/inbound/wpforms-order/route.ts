import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { asNumberString, asText, formatOptionalDate, ingestLead, InboundLeadError } from "@/lib/inbound-leads";

type IncomingPayload = {
  submissionType?: string;
  externalId?: string | number;
  customerName?: string;
  email?: string;
  companyName?: string;
  phone?: string;
  notes?: string;
  qty?: string | number | null;
  nbd?: string | Date | null;
};

function authorized(request: NextRequest) {
  const expected = process.env.ZAPIER_INBOUND_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!expected || !header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const wanted = Buffer.from(expected);
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

export async function POST(request: NextRequest) {
  if (!process.env.ZAPIER_INBOUND_SECRET) return NextResponse.json({ error: "Inbound webhook secret is not configured" }, { status: 500 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) return NextResponse.json({ error: "Payload is too large" }, { status: 413 });

  try {
    const body = await request.json() as IncomingPayload;
    const result = await ingestLead({
      source: "wpforms",
      submissionType: asText(body.submissionType, "wpforms_order"),
      externalId: asText(body.externalId),
      customerName: asText(body.customerName),
      companyName: asText(body.companyName),
      email: asText(body.email),
      phone: asText(body.phone),
      notes: asText(body.notes),
      nbd: formatOptionalDate(body.nbd),
      channel: "Forms",
      orderNumber: "",
      currency: "SGD",
      orderTotal: "",
      billingAddress: "",
      qty: asNumberString(body.qty),
      subitems: [],
    });
    return NextResponse.json(result, { status: result.statusCode });
  } catch (error) {
    const status = error instanceof InboundLeadError ? error.statusCode : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status });
  }
}

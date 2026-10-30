import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { asNumberString, asText, ingestLead, InboundLeadError, normalizeSubitems } from "@/lib/inbound-leads";

type IncomingPayload = {
  data?: unknown;
  client?: unknown;
  submissionType?: string;
  externalId?: string | number;
  orderNumber?: string | number;
  customerName?: string;
  email?: string;
  companyName?: string;
  phone?: string;
  notes?: string;
  billingAddress?: string;
  currency?: string;
  orderTotal?: string | number | null;
  subitems?: unknown;
  line_items?: unknown;
  lineItems?: unknown;
  items?: unknown;
  products?: unknown;
};

type PayloadRecord = Record<string, unknown>;

function asRecord(value: unknown): PayloadRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as PayloadRecord)
    : null;
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null);
}

/**
 * Zapier can forward either the original flat WooCommerce fields or the
 * assignment-event envelope emitted by the CRM (`data.client.*`).  Read both
 * deliberately so an accepted order can never silently lose its line items.
 */
function resolveIncomingOrder(body: IncomingPayload) {
  const data = asRecord(body.data);
  const nestedClient = asRecord(data?.client);
  const client = asRecord(body.client) ?? nestedClient;
  const root = body as PayloadRecord;
  const value = (key: string) => firstDefined(
    root[key],
    data?.[key],
    client?.[key],
  );
  const subitems = firstDefined(
    root.subitems,
    root.line_items,
    root.lineItems,
    root.order_items,
    root.orderItems,
    root.items,
    root.products,
    root.clientSubitems,
    data?.subitems,
    client?.subitems,
    client?.line_items,
    client?.lineItems,
    client?.order_items,
    client?.orderItems,
    client?.items,
    client?.products,
  );

  return { value, subitems };
}

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
    const incoming = resolveIncomingOrder(body);
    const subitems = normalizeSubitems(incoming.subitems).filter(
      (subitem) => Boolean(subitem.name.trim()),
    );
    // A WooCommerce order should always have at least one line item. Failing
    // explicitly is safer than silently creating a client with no order
    // details when Zapier changes how it serialises its input again.
    if (!subitems.length) {
      return NextResponse.json(
        {
          error:
            "WooCommerce order contains no readable subitems. Map Code by Zapier's subitems output to the webhook field named subitems.",
        },
        { status: 400 },
      );
    }
    const result = await ingestLead({
      source: "woocommerce",
      submissionType: asText(incoming.value("submissionType"), "woocommerce_order"),
      externalId: asText(incoming.value("externalId")),
      customerName: asText(firstDefined(incoming.value("customerName"), incoming.value("name"))),
      companyName: asText(incoming.value("companyName")),
      email: asText(firstDefined(incoming.value("email"), incoming.value("clientEmail"))),
      phone: asText(firstDefined(incoming.value("phone"), incoming.value("clientPhone"))),
      notes: asText(firstDefined(incoming.value("notes"), incoming.value("requirements"), incoming.value("clientRequirements"))),
      nbd: "",
      channel: "E-comm",
      orderNumber: asText(incoming.value("orderNumber")),
      currency: asText(incoming.value("currency"), "SGD").toUpperCase(),
      orderTotal: asNumberString(incoming.value("orderTotal")),
      billingAddress: asText(incoming.value("billingAddress")),
      qty: "",
      subitems,
    });
    return NextResponse.json(result, { status: result.statusCode });
  } catch (error) {
    const status = error instanceof InboundLeadError ? error.statusCode : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status });
  }
}

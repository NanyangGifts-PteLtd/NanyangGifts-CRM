import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type IncomingPayload = {
    source?: string;
    submissionType?: string;
    externalId?: string;
    customerName?: string;
    email?: string;
    companyName?: string;
    phone?: string;
    notes?: string;
    qty?: string | number | null;
    nbd?: string | Date | null;
    raw?: unknown;
};

function asText(value: unknown, fallback = "") {
    if (value == null) return fallback;
    return String(value).trim();
}

function asNumberString(value: unknown, fallback = "") {
    if (value == null || value === "") return fallback;
    const n =
        typeof value === "number"
            ? value
            : Number(String(value).replace(/,/g, "").trim());

    return Number.isFinite(n) ? String(n) : fallback;
}

function formatDateText(value: unknown, fallback = "") {
    if (!value) return fallback;

    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return fallback;

    return date.toLocaleDateString("en-SG");
}

function buildActivityLogEntry(payload: IncomingPayload) {
    return {
        type: "inbound_webhook",
        source: payload.source ?? "wordpress-zapier",
        submissionType: payload.submissionType ?? "wpforms_order",
        externalId: payload.externalId ?? "",
        createdAt: new Date().toISOString(),
        message: "Lead created from WordPress/WPForms via Zapier",
    };
}

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        const expectedToken = process.env.ZAPIER_INBOUND_SECRET;

        if (!expectedToken) {
            return NextResponse.json(
                { error: "Missing ZAPIER_INBOUND_SECRET" },
                { status: 500 }
            );
        }

        if (authHeader !== `Bearer ${expectedToken}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await req.json()) as IncomingPayload;

        const externalId = asText(body.externalId);
        const customerName = asText(body.customerName);
        const email = asText(body.email);
        const companyName = asText(body.companyName);
        const phone = asText(body.phone);
        const notes = asText(body.notes);
        const qty = asNumberString(body.qty, "");
        const today = new Date().toLocaleDateString("en-SG");
        const nbd = formatDateText(body.nbd, "");

        if (!externalId) {
            return NextResponse.json({ error: "Missing externalId" }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: existingClient, error: existingClientError } = await supabase
            .from("clients")
            .select("id, nbd")
            .eq("nbd", externalId)
            .maybeSingle();

        if (existingClientError) {
            return NextResponse.json(
                { error: existingClientError.message },
                { status: 500 }
            );
        }

        if (existingClient) {
            return NextResponse.json({
                ok: true,
                duplicate: true,
                clientId: existingClient.id,
                message: "Client already exists for this externalId",
            });
        }

        const { data: newLeadGroup, error: groupError } = await supabase
            .from("crm_groups")
            .select("id, name")
            .ilike("name", "New Lead")
            .maybeSingle();

        if (groupError) {
            return NextResponse.json({ error: groupError.message }, { status: 500 });
        }

        if (!newLeadGroup?.id) {
            return NextResponse.json(
                { error: 'crm_groups row "New Lead" not found' },
                { status: 500 }
            );
        }

        const clientInsert = {
            name: customerName || companyName || "New Lead",
            people: "",
            reply_status: "",
            follow_up: "",
            status: "New Lead",
            channel: "Forms",
            importance: "",
            company: companyName,
            email,
            phone,
            requirements: notes,
            nbd: externalId,
            total_price: "",
            company_address: "",
            billing_address: "",
            date_created: today,
            expanded: false,
            color: "#7BCBD5",
            activity_log: [buildActivityLogEntry(body)],
            group_id: newLeadGroup.id,
            custom_fields: {
                source: body.source ?? "wordpress-zapier",
                submissionType: body.submissionType ?? "wpforms_order",
                qty,
                requested_nbd: nbd,
                raw: body.raw ?? null,
            },
        };

        const { data: client, error: clientError } = await supabase
            .from("clients")
            .insert(clientInsert)
            .select("id")
            .single();

        if (clientError) {
            return NextResponse.json({ error: clientError.message }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            clientId: client.id,
            message: "WPForms lead created successfully",
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "Invalid request" },
            { status: 400 }
        );
    }
}
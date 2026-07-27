// for woocommerce orders
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type IncomingSubitem = {
    name?: string;
    qty?: string | number | null;
};

type IncomingPayload = {
    source?: string;
    submissionType?: string;
    externalId?: string;
    orderNumber?: string;
    customerName?: string;
    email?: string;
    companyName?: string;
    phone?: string;
    notes?: string;
    companyAddress?: string;
    billingAddress?: string;
    currency?: string;
    orderTotal?: string | number | null;
    subitems?: IncomingSubitem[] | string | null;
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

function normalizeSubitems(input: IncomingPayload["subitems"]) {
    if (Array.isArray(input)) {
        return input.map(normalizeItem);
    }

    if (typeof input === "string" && input.trim()) {
        try {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed)) return parsed.map(normalizeItem);
            
            if (typeof parsed === "string") {
                const parsedAgain = JSON.parse(parsed);
                if (Array.isArray(parsedAgain)) return parsedAgain.map(normalizeItem);
            }
        } catch { }

        return input
            .split("\n")
            .filter(Boolean)
            .map((line) => ({
                name: line.trim(), qty: ""
            }));
    }

    return [];
}

function normalizeItem(item: IncomingSubitem) {
    return {
        name: asText(item?.name, "Untitled subitem"),
        qty: asText(item?.qty, "")
    };
}

function buildActivityLogEntry(payload: IncomingPayload) {
    return {
        type: "inbound_webhook",
        source: payload.source ?? "wordpress-zapier",
        submissionType: payload.submissionType ?? "woocommerce_order",
        externalId: payload.externalId ?? "",
        createdAt: new Date().toISOString(),
        message: "Lead created from WordPress/WooCommerce via Zapier",
    };
}

function addDays(dateString: string, days: number) {
    if (!dateString) return "";
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";

    date.setDate(date.getDate() + days);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
        const companyAddress = asText(body.companyAddress);
        const billingAddress = asText(body.billingAddress);
        const orderTotal = asNumberString(body.orderTotal, "");
        const subitems = normalizeSubitems(body.subitems);
        const today = new Date().toLocaleDateString('en-SG');
        const followUp = addDays(today, 3);

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
            reply_status: "Waiting...",
            follow_up: followUp,
            status: "New Lead",
            channel: "E-comm",
            importance: "",
            company: companyName,
            email,
            phone,
            requirements: notes,
            nbd: externalId,
            total_price: orderTotal,
            company_address: companyAddress,
            billing_address: billingAddress,
            date_created: today,
            expanded: false,
            color: "#7BCBD5",
            activity_log: [buildActivityLogEntry(body)],
            group_id: newLeadGroup.id,
            custom_fields: {
                source: body.source ?? "wordpress-zapier",
                submissionType: body.submissionType ?? "woocommerce_order",
                orderNumber: asText(body.orderNumber),
                currency: asText(body.currency, "SGD"),
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

        if (subitems.length > 0) {
            const subitemRows = subitems.map((item) => ({
                client_id: client.id,
                name: item.name,
                people: "",
                status: "",
                qty: item.qty,
                description: "",
                remarks: "",
                shipper: "",
                supplier: "",
                cost: "",
                ls: "",
                os: "",
                tc: "",
                uc: "",
                tc_sgd: "",
                price: "",
                up: "",
                owner: "",
                payment_status: "",
                manpower: "",
                ls_rmb: "",
                total_c: "",
                mode_of_payment: "",
                order_number: asText(body.orderNumber),
                quantity_produced: "",
                sample: "",
                qty_for: "",
                payment_amount: "",
                difference: "",
                local_overseas: "Local",
                num_of_cartons: "",
                payment_remarks: "",
                cn_tracking: "",
                sg_tracking: "",
                sample_order_status: "",
                sample_status: "",
                sample_type: "",
                timeline_rows: [],
                show_timeline: false,
                show_payments: false,
                sample_rows: [],
                show_sample: false,
                pl: null,
                sl: null,
                currency: asText(body.currency, "SGD"),
                c_sgd: null,
                manpower_rmb: null,
                total_uc: null,
                custom_fields: {},
            }));

            const { error: subitemsError } = await supabase
                .from("subitems")
                .insert(subitemRows);

            if (subitemsError) {
                return NextResponse.json(
                    {
                        error: subitemsError.message,
                        clientId: client.id,
                        message: "Client created but subitems insert failed",
                    },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            ok: true,
            clientId: client.id,
            subitemsInserted: subitems.length,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "Invalid request" },
            { status: 400 }
        );
    }
}
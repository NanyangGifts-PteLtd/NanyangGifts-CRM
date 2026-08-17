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

function formatDateForInput(value: unknown, fallback = "") {
    if (!value) return fallback;

    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return fallback;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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

function todayForInput() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function buildActivityLogEntry(payload: IncomingPayload, assignedUserId?: string) {
    return {
        type: "inbound_webhook",
        source: payload.source ?? "wordpress-zapier",
        submissionType: payload.submissionType ?? "wpforms_order",
        externalId: payload.externalId ?? "",
        createdAt: new Date().toISOString(),
        assignedUserId: assignedUserId ?? null,
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
        const dateCreated = todayForInput();
        const createdAt = new Date().toISOString();
        const nbd = formatDateForInput(body.nbd, "");
        const followUp = addDays(dateCreated, 3);

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

        const { data: assigneeData, error: assigneeError } = await supabase.rpc(
            "get_next_sales_assignee"
        );

        if (assigneeError) {
            return NextResponse.json({ error: assigneeError.message }, { status: 500 });
        }

        const nextAssignee = Array.isArray(assigneeData)
            ? assigneeData[0] ?? null
            : assigneeData ?? null;

        if (!nextAssignee?.user_id) {
            return NextResponse.json(
                { error: "No sales assignee returned from round robin function" },
                { status: 500 }
            );
        }

        const clientInsert = {
            name: customerName || companyName || "New Lead",
            people: "",
            reply_status: "Waiting...",
            follow_up: followUp,
            status: "New Lead",
            channel: "Forms",
            importance: "",
            company: companyName,
            email,
            phone,
            requirements: notes,
            nbd: nbd,
            total_price: "",
            company_address: "",
            billing_address: "",
            created_at: createdAt,
            expanded: false,
            color: "#7BCBD5",
            activity_log: [
                buildActivityLogEntry(body, nextAssignee.user_id)
            ],
            group_id: newLeadGroup.id,
            custom_fields: {
                source: body.source ?? "wordpress-zapier",
                submissionType: body.submissionType ?? "wpforms_order",
                external_id: externalId,
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

        const { error: assigneeInsertError } = await supabase
            .from("client_assignees")
            .insert({
                client_id: client.id,
                user_id: nextAssignee.user_id,
            });

        if (assigneeInsertError) {
            return NextResponse.json(
                {
                    error: assigneeInsertError.message,
                    clientId: client.id,
                    message: "Client created but assignee insert failed",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            ok: true,
            clientId: client.id,
            assignedUserId: nextAssignee?.user_id ?? null,
            message: "WPForms lead created successfully",
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "Invalid request" },
            { status: 400 }
        );
    }
}
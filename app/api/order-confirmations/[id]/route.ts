import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteContext) {
    const { id } = await params;
    const supabase = await createClient();

    try {
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: ocf, error: ocfError } = await supabase
            .from("order_confirmations")
            .select(`
        id,
        client_id,
        generated_by,
        generated_at,
        client_name_snapshot,
        company_snapshot,
        salesperson_name,
        salesperson_phone,
        salesperson_email,
        estimated_delivery_date,
        important_notes,
        status,
        client_token,
        client_signed_at,
        client_ip,
        client_signature_path,
        client_submitted_at,
        locked_at
      `)
            .eq("id", id)
            .single();

        if (ocfError || !ocf) {
            return NextResponse.json(
                { error: ocfError?.message || "Order confirmation not found" },
                { status: 404 }
            );
        }

        const { data: items, error: itemsError } = await supabase
            .from("order_confirmation_items")
            .select(`
        id,
        order_confirmation_id,
        subitem_id,
        qty,
        name,
        remarks,
        image_path
        `)
            .eq("order_confirmation_id", id);

        if (itemsError) {
            return NextResponse.json(
                { error: itemsError.message || "Failed to load order confirmation items" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            ocf,
            items: items ?? [],
        });
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch order confirmation",
            },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    const { id } = await params;
    const supabase = await createClient();

    try {
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        const {
            salesperson_name,
            salesperson_phone,
            salesperson_email,
            estimated_delivery_date,
            important_notes,
        } = body ?? {};

        const { data: existing, error: existingError } = await supabase
            .from("order_confirmations")
            .select("id, status, locked_at")
            .eq("id", id)
            .single();

        if (existingError || !existing) {
            return NextResponse.json(
                { error: "Order confirmation not found" },
                { status: 404 }
            );
        }

        if (
            existing.locked_at ||
            existing.status === "locked" ||
            existing.status === "submitted"
        ) {
            return NextResponse.json(
                { error: "This order confirmation is locked and can no longer be edited" },
                { status: 403 }
            );
        }

        const updates: Record<string, unknown> = {};

        if (typeof salesperson_name === "string") {
            updates.salesperson_name = salesperson_name;
        }

        if (typeof salesperson_phone === "string") {
            updates.salesperson_phone = salesperson_phone;
        }

        if (typeof salesperson_email === "string") {
            updates.salesperson_email = salesperson_email;
        }

        if (
            estimated_delivery_date === null ||
            typeof estimated_delivery_date === "string"
        ) {
            updates.estimated_delivery_date = estimated_delivery_date;
        }

        if (typeof important_notes === "string") {
            updates.important_notes = important_notes;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        const { data: updated, error: updateError } = await supabase
            .from("order_confirmations")
            .update(updates)
            .eq("id", id)
            .select(`
        id,
        client_id,
        generated_by,
        generated_at,
        client_name_snapshot,
        company_snapshot,
        salesperson_name,
        salesperson_phone,
        salesperson_email,
        estimated_delivery_date,
        important_notes,
        status,
        client_token,
        client_signed_at,
        client_ip,
        client_signature_path,
        client_submitted_at,
        locked_at
        `)
            .single();

        if (updateError || !updated) {
            return NextResponse.json(
                { error: updateError?.message || "Failed to update order confirmation" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            ocf: updated,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to update order confirmation",
            },
            { status: 500 }
        );
    }
}
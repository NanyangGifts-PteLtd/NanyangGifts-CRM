import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getClientIp(request: NextRequest) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0]?.trim() || "0.0.0.0";
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
        return realIp.trim();
    }

    return "0.0.0.0";
}

function base64ToBuffer(dataUrl: string) {
    const parts = dataUrl.split(",");
    const base64 = parts.length > 1 ? parts[1] : parts[0];
    return Buffer.from(base64, "base64");
}

type SubmittedItem = {
    id: string;
    delivery_name?: string | null;
    delivery_address?: string | null;
    delivery_contact_number?: string | null;
    delivery_remarks?: string | null;
};

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    try {
        const body = await request.json();

        const {
            ocfId,
            clientToken,
            signatureDataUrl,
            company,
            recipientName,
            restrictedArea,
            sameAddressForAllItems,
            items,
        } = body ?? {};

        if (!ocfId || !clientToken || !signatureDataUrl) {
            return NextResponse.json(
                { error: "ocfId, clientToken, and signatureDataUrl are required" },
                { status: 400 }
            );
        }

        if (
            typeof company !== "string" ||
            typeof recipientName !== "string" ||
            typeof restrictedArea !== "string" ||
            typeof sameAddressForAllItems !== "boolean" ||
            !Array.isArray(items)
        ) {
            return NextResponse.json(
                {
                    error:
                        "company, recipientName, restrictedArea, sameAddressForAllItems, and items are required",
                },
                { status: 400 }
            );
        }

        const allowedRestrictedAreaValues = [
            "No",
            "Yes, additional fees apply. Please check with salesperson.",
        ];

        if (!allowedRestrictedAreaValues.includes(restrictedArea)) {
            return NextResponse.json(
                { error: "Invalid restrictedArea value" },
                { status: 400 }
            );
        }

        const { data: ocf, error: ocfError } = await supabase
            .from("order_confirmations")
            .select("id, client_token, status, locked_at")
            .eq("id", ocfId)
            .eq("client_token", clientToken)
            .single();

        if (ocfError || !ocf) {
            return NextResponse.json(
                { error: "Invalid order confirmation link" },
                { status: 404 }
            );
        }

        if (
            ocf.locked_at ||
            ocf.status === "locked" ||
            ocf.status === "submitted"
        ) {
            return NextResponse.json(
                { error: "This order confirmation has already been submitted" },
                { status: 409 }
            );
        }

        const filePath = `ocf-signatures/${ocf.id}/signature-${Date.now()}.png`;
        const fileBuffer = base64ToBuffer(signatureDataUrl);

        const { error: uploadError } = await supabase.storage
            .from("order-confirmation-files")
            .upload(filePath, fileBuffer, {
                contentType: "image/png",
                upsert: false,
            });

        if (uploadError) {
            return NextResponse.json(
                { error: uploadError.message || "Failed to upload signature" },
                { status: 500 }
            );
        }

        const now = new Date().toISOString();
        const clientIp = getClientIp(request);

        const { data: updatedOcf, error: updateOcfError } = await supabase
            .from("order_confirmations")
            .update({
                company_snapshot: company.trim() || null,
                recipient_name: recipientName.trim() || null,
                restricted_area: restrictedArea,
                same_address_for_all_items: sameAddressForAllItems,
                client_signature_path: filePath,
                client_signed_at: now,
                client_submitted_at: now,
                client_ip: clientIp,
                status: "submitted",
                locked_at: now,
            })
            .eq("id", ocf.id)
            .eq("client_token", clientToken)
            .select(`
        id,
        status,
        company_snapshot,
        recipient_name,
        restricted_area,
        same_address_for_all_items,
        client_signed_at,
        client_submitted_at,
        client_ip,
        client_signature_path,
        locked_at
      `)
            .single();

        if (updateOcfError || !updatedOcf) {
            return NextResponse.json(
                { error: updateOcfError?.message || "Failed to update order confirmation" },
                { status: 500 }
            );
        }

        for (const item of items as SubmittedItem[]) {
            if (!item?.id) continue;

            const { error: itemUpdateError } = await supabase
                .from("order_confirmation_items")
                .update({
                    delivery_name: item.delivery_name?.trim() || null,
                    delivery_address: item.delivery_address?.trim() || null,
                    delivery_contact_number: item.delivery_contact_number?.trim() || null,
                    delivery_remarks: item.delivery_remarks?.trim() || null,
                })
                .eq("id", item.id)
                .eq("order_confirmation_id", ocf.id);

            if (itemUpdateError) {
                return NextResponse.json(
                    { error: itemUpdateError.message || "Failed to update delivery information" },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            ocf: updatedOcf,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to submit order confirmation",
            },
            { status: 500 }
        );
    }
}
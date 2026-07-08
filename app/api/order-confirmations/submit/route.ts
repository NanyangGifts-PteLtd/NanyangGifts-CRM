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

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    try {
        const body = await request.json();

        const { ocfId, clientToken, signatureDataUrl } = body ?? {};

        if (!ocfId || !clientToken || !signatureDataUrl) {
            return NextResponse.json(
                { error: "ocfId, clientToken, and signatureDataUrl are required" },
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

        const { data: updated, error: updateError } = await supabase
            .from("order_confirmations")
            .update({
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
        client_signed_at,
        client_submitted_at,
        client_ip,
        client_signature_path,
        locked_at
        `)
            .single();

        if (updateError || !updated) {
            return NextResponse.json(
                { error: updateError?.message || "Failed to submit order confirmation" },
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
                        : "Failed to submit order confirmation",
            },
            { status: 500 }
        );
    }
}
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_ROLES = ["sales", "pm", "admin", "dev", "shipper"] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        }

        if (profile?.role !== "director" && profile?.role !== "dev") {
            return NextResponse.json({ error: "Only directors and dev users can invite accounts." }, { status: 403 });
        }

        const body = await request.json() as { email?: string; role?: string };
        const email = body.email?.trim().toLowerCase();
        const role = body.role as AllowedRole | undefined;

        if (!email || !role || !ALLOWED_ROLES.includes(role)) {
            return NextResponse.json(
                { error: "A valid email and role are required." },
                { status: 400 },
            );
        }

        const redirectTo = new URL("/auth/invite", request.url).toString();
        const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            redirectTo,
            data: { role },
        });

        if (inviteError) {
            return NextResponse.json({ error: inviteError.message }, { status: 400 });
        }

        if (data.user) {
            const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
                app_metadata: { ...(data.user.app_metadata ?? {}), must_change_password: true },
            });
            if (metadataError) {
                return NextResponse.json({ error: `Invitation sent, but password setup could not be enforced: ${metadataError.message}` }, { status: 500 });
            }
            const { error: profileUpsertError } = await supabaseAdmin
                .from("profiles")
                .upsert(
                    { id: data.user.id, email, role },
                    { onConflict: "id" },
                );

            if (profileUpsertError) {
                return NextResponse.json(
                    { error: `Invitation sent, but the profile role could not be saved: ${profileUpsertError.message}` },
                    { status: 500 },
                );
            }
        }

        return NextResponse.json({
            ok: true,
            userId: data.user?.id ?? null,
            email,
            role,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unexpected server error" },
            { status: 500 },
        );
    }
}

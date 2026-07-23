import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_IMPORTANT_NOTES } from "@/components/Important-Notes";

type SaveOcfImportantNotesBody = {
    importantNotes?: string | null;
};

export async function GET() {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: setting, error: settingError } = await supabase
            .from("app_settings")
            .select("key, value")
            .eq("key", "ocf_important_notes")
            .maybeSingle();

        if (settingError) {
            return NextResponse.json({ error: settingError.message }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            importantNotes: setting?.value ?? DEFAULT_IMPORTANT_NOTES,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message ?? "Unexpected server error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

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
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = (await req.json()) as SaveOcfImportantNotesBody;
        const importantNotes = body.importantNotes?.trim() || DEFAULT_IMPORTANT_NOTES;

        const { error: upsertError } = await supabase
            .from("app_settings")
            .upsert(
                {
                    key: "ocf_important_notes",
                    value: importantNotes,
                },
                { onConflict: "key" }
            );

        if (upsertError) {
            return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            importantNotes,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message ?? "Unexpected server error" },
            { status: 500 }
        );
    }
}
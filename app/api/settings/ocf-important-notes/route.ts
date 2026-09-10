import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_IMPORTANT_NOTES, DEFAULT_STRICT_NEED_BY_WARNING } from "@/components/Important-Notes";

type SaveOcfImportantNotesBody = {
    importantNotes?: string | null;
    strictNeedByWarning?: string | null;
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

        const { data: settings, error: settingError } = await supabase
            .from("app_settings")
            .select("key, value")
            .in("key", ["ocf_important_notes", "ocf_strict_need_by_warning"]);

        if (settingError) {
            return NextResponse.json({ error: settingError.message }, { status: 500 });
        }

        const settingMap = new Map((settings ?? []).map((setting) => [setting.key, setting.value]));
        return NextResponse.json({
            ok: true,
            importantNotes: settingMap.get("ocf_important_notes") ?? DEFAULT_IMPORTANT_NOTES,
            strictNeedByWarning: settingMap.get("ocf_strict_need_by_warning") ?? DEFAULT_STRICT_NEED_BY_WARNING,
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

        if (!['director', 'dev'].includes(String(profile?.role ?? '').toLowerCase())) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = (await req.json()) as SaveOcfImportantNotesBody;
        const importantNotes = body.importantNotes?.trim() || DEFAULT_IMPORTANT_NOTES;
        const strictNeedByWarning = body.strictNeedByWarning?.trim() || DEFAULT_STRICT_NEED_BY_WARNING;

        const { error: upsertError } = await supabase
            .from("app_settings")
            .upsert([
                {
                    key: "ocf_important_notes",
                    value: importantNotes,
                },
                {
                    key: "ocf_strict_need_by_warning",
                    value: strictNeedByWarning,
                },
            ], { onConflict: "key" });

        if (upsertError) {
            return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            importantNotes,
            strictNeedByWarning,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message ?? "Unexpected server error" },
            { status: 500 }
        );
    }
}

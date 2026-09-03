import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const RESULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!["sales", "pm", "admin", "director", "dev"].includes(profile?.role?.toLowerCase() ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  let query = supabaseAdmin
    .from("industry_options")
    .select("id, code, name, section_code, section_name")
    .eq("classification", "SSIC")
    .eq("classification_year", 2025)
    .eq("is_active", true)
    .order("code")
    .limit(RESULT_LIMIT);

  if (search) {
    // Commas delimit PostgREST OR clauses, while % and _ are SQL wildcards. Removing
    // them keeps user input as literal search text and avoids malformed filters.
    const safeSearch = search.replace(/[%_,()."]/g, " ").replace(/\s+/g, " ").trim();
    if (safeSearch) query = query.or(`code.ilike.${safeSearch}%,name.ilike.%${safeSearch}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ options: data ?? [] });
}

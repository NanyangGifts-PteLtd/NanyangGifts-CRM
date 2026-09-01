import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "crm-files";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (!path || path.includes("..") || path.startsWith("/")) return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message || "File not found" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}

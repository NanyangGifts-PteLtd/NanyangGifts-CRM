import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSingaporeWorkingDay, nextSingaporeWorkingDay } from "@/lib/working-calendar";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = request.nextUrl.searchParams.get("date") ?? "";
  try {
    const isWorkingDay = await isSingaporeWorkingDay(date);
    return NextResponse.json({ isWorkingDay, nextWorkingDay: isWorkingDay ? date : await nextSingaporeWorkingDay(date) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid date." }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addSingaporeWorkingDays } from "@/lib/working-calendar";

function singaporeToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = Number(request.nextUrl.searchParams.get("days") ?? "");
  if (!Number.isInteger(days) || days < 0)
    return NextResponse.json(
      { error: "days must be a non-negative whole number." },
      { status: 400 },
    );

  try {
    return NextResponse.json({
      date: await addSingaporeWorkingDays(singaporeToday(), days),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not use the working calendar." },
      { status: 500 },
    );
  }
}

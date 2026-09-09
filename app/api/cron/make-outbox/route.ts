import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { dispatchPendingMakeEvents } from "@/lib/make-integration";

function authorized(request: NextRequest) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const allowed = [process.env.CRON_SECRET, process.env.MAKE_INTEGRATION_SECRET]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return allowed.some((secret) => {
    const left = Buffer.from(supplied);
    const right = Buffer.from(secret);
    return left.length === right.length && timingSafeEqual(left, right);
  });
}

async function run(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? 20);
  const results = await dispatchPendingMakeEvents(Number.isFinite(requestedLimit) ? requestedLimit : 20);
  return NextResponse.json({
    ok: true,
    attempted: results.length,
    delivered: results.filter((result) => "delivered" in result && result.delivered).length,
    results,
  });
}

export const GET = run;
export const POST = run;

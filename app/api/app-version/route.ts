import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * This response must never be cached: an older browser tab uses it to detect
 * that Vercel is now routing the production domain to a newer deployment.
 */
export async function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_DEPLOYMENT_ID ??
    "development";

  return NextResponse.json(
    { version },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

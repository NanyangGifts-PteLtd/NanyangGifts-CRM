import { NextResponse } from "next/server";
import {
  authorizeQuickBooksBillRead,
  listQuickBooksTerms,
} from "@/lib/quickbooks/bill-options";

export async function GET() {
  try {
    await authorizeQuickBooksBillRead();
    return NextResponse.json({ terms: await listQuickBooksTerms() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load QuickBooks terms.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

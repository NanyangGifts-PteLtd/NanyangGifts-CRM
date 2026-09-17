import { NextResponse } from "next/server";
import {
  authorizeQuickBooksBillRead,
  listQuickBooksVendors,
} from "@/lib/quickbooks/bill-options";

export async function GET() {
  try {
    await authorizeQuickBooksBillRead();
    return NextResponse.json({ vendors: await listQuickBooksVendors() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load QuickBooks suppliers.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

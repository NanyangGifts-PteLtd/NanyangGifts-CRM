import { NextResponse } from "next/server";
import {
  authorizeQuickBooksBillRead,
  listQuickBooksTaxCodes,
} from "@/lib/quickbooks/bill-options";

export async function GET() {
  try {
    await authorizeQuickBooksBillRead();
    return NextResponse.json({ taxCodes: await listQuickBooksTaxCodes() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load QuickBooks GST codes.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

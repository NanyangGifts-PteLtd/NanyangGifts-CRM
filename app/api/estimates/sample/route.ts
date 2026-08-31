import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ELIGIBLE = new Set(["Quoted", "Shortlisted", "Awarded"]);

function pdfText(value: unknown) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/[()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "?");
}

function makePdf(lines: string[]) {
    const content = lines.slice(0, 45).map((line, index) => `BT /F1 ${index === 0 ? 19 : 10} Tf 50 ${790 - index * 16} Td (${pdfText(line)}) Tj ET`).join("\n");
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, "utf8")); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
}

function numberValue(value: unknown) {
    const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { clientId } = await req.json() as { clientId?: string };
    if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    const { data: client, error } = await supabase.from("clients").select("*, subitems(*)").eq("id", clientId).single();
    if (error || !client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    if (!client.company?.trim()) return NextResponse.json({ error: "Client company name is required" }, { status: 400 });
    const subitems = (client.subitems ?? [])
        .filter((item: any) => ELIGIBLE.has((item.status ?? "").trim()))
        .sort((first: any, second: any) => Number(first.position ?? Number.MAX_SAFE_INTEGER) - Number(second.position ?? Number.MAX_SAFE_INTEGER));
    if (!subitems.length) return NextResponse.json({ error: "No eligible subitems with Quoted, Shortlisted, or Awarded status" }, { status: 400 });
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
    const rows: Array<{ name: string; description: string; qty: number; unitPrice: number; amount: number }> = subitems.map((item: any) => {
        const qty = numberValue(item.qty) || 1;
        const unitPrice = numberValue(item.up) || (qty > 0 ? numberValue(item.price) / qty : 0);
        return { name: item.name || "Unnamed item", description: item.description || "", qty, unitPrice, amount: qty * unitPrice };
    });
    const total = rows.reduce((sum: number, row) => sum + row.amount, 0);
    const lines = [
        "SAMPLE ESTIMATE - NOT SENT TO QUICKBOOKS",
        `Customer: ${client.company}`,
        `Contact: ${client.name || "-"}`,
        `Email: ${client.email || "-"}`,
        `Date: ${new Date().toLocaleDateString("en-GB")}`,
        "",
        "Item                                      Qty      Unit Price       Amount",
        "--------------------------------------------------------------------------------",
        ...rows.flatMap((row) => [`${row.name.slice(0, 38).padEnd(40)} ${String(row.qty).padStart(5)} ${row.unitPrice.toFixed(2).padStart(14)} ${row.amount.toFixed(2).padStart(12)}`, row.description ? `  -${row.description}` : ""]),
        "--------------------------------------------------------------------------------",
        `TOTAL: ${total.toFixed(2)}`,
        "",
        "This is a CRM preview only. No QuickBooks customer, item, or estimate was created.",
    ];
    const filename = `Sample Estimate - ${String(client.company).replace(/[^a-z0-9]+/gi, " ").trim() || "Client"}.pdf`;
    return NextResponse.json({ ok: true, filename, url: `data:application/pdf;base64,${makePdf(lines).toString("base64")}`, createdAt: new Date().toISOString(), createdBy: profile?.full_name?.trim() || profile?.email || "CRM user" });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ELIGIBLE = new Set(["Quoted", "Shortlisted", "Awarded"]);
const W = 595.28;
const H = 841.89;
type ArtworkInput = { subitemId: string; dataUrl: string };
type EstimateLine = { name: string; description: string; qty: number; unitPrice: number; amount: number; artwork?: string };

function safeText(value: unknown) {
    // Standard PDF fonts cannot draw typographic dashes or other unicode punctuation.
    return String(value ?? "").replace(/[\r\n]+/g, " ").replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "");
}
function numberValue(value: unknown) {
    const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
}
function dataUrlBytes(dataUrl: string) {
    const match = /^data:(image\/(?:png|jpeg|jpg));base64,([a-z0-9+/=]+)$/i.exec(dataUrl);
    return match ? { mime: match[1].toLowerCase(), bytes: Buffer.from(match[2], "base64") } : null;
}
async function embedImage(pdf: PDFDocument, dataUrl?: string): Promise<PDFImage | null> {
    const source = dataUrl ? dataUrlBytes(dataUrl) : null;
    if (!source) return null;
    try { return source.mime === "image/png" ? await pdf.embedPng(source.bytes) : await pdf.embedJpg(source.bytes); } catch { return null; }
}
function fit(image: PDFImage, maxWidth: number, maxHeight: number) {
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    return { width: image.width * scale, height: image.height * scale };
}
function wrap(value: string, font: PDFFont, size: number, maxWidth: number) {
    const lines: string[] = []; let current = "";
    for (const word of safeText(value).split(/\s+/).filter(Boolean)) {
        const next = current ? `${current} ${word}` : word;
        if (current && font.widthOfTextAtSize(next, size) > maxWidth) { lines.push(current); current = word; } else current = next;
    }
    if (current) lines.push(current);
    return lines;
}

async function makePdf({ client, rows, createdBy }: { client: any; rows: EstimateLine[]; createdBy: string }) {
    const pdf = await PDFDocument.create();
    let page = pdf.addPage([W, H]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.204, 0.451, 0.886), paleBlue = rgb(0.839, 0.89, 0.976), slate = rgb(0.4, 0.43, 0.48), border = rgb(0.65, 0.65, 0.65);
    const text = (value: unknown, x: number, top: number, size = 10, isBold = false, color = rgb(0, 0, 0)) => page.drawText(safeText(value), { x, y: H - top - size, size, font: isBold ? bold : regular, color });
    const line = (x1: number, top: number, x2: number, color = navy, thickness = 1) => page.drawLine({ start: { x: x1, y: H - top }, end: { x: x2, y: H - top }, color, thickness });
    const box = (x: number, top: number, width: number, height: number, fill?: ReturnType<typeof rgb>, stroke = border, thickness = 0.3) => page.drawRectangle({ x, y: H - top - height, width, height, color: fill, borderColor: stroke, borderWidth: thickness });
    const money = (value: number) => `S$${value.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const subtotal = rows.reduce((sum, row) => sum + row.amount, 0), gst = subtotal * 0.09, total = subtotal + gst;

    try {
        const logo = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "logo-with-company-name.png")));
        const size = fit(logo, 185, 70);
        page.drawImage(logo, { x: 20, y: H - 26 - size.height, ...size });
    } catch { text("NanyangGifts Pte. Ltd.", 24, 48, 10, true); }
    ["NanyangGifts Pte. Ltd.", "#07-01, 3 Little Road", "Singapore 536982", "+65 6282 1225", "sales@nanyanggifts.com", "www.nanyanggifts.com", "GST Registration No.: 201426646R", "Company Registration No. 201426646R"].forEach((item, index) => text(item, 225, 24 + index * 12, 8, index === 0));
    text("QUOTATION", 455, 49, 16, true, navy);
    line(18, 140, 577, navy, 1.5);
    text("ADDRESS", 20, 157, 8, true);
    [client.company || client.name || "Customer", client.billing_address || "", client.email || "", client.phone || ""].filter(Boolean).slice(0, 4).forEach((item: string, index: number) => text(item, 20, 174 + index * 13, 9));
    box(298, 152, 87, 58, paleBlue, paleBlue, 0); text("DATE", 325, 176, 9, true, navy); text(new Date().toLocaleDateString("en-GB"), 311, 194, 9);
    box(385, 152, 96, 58, navy, navy, 0); text("TOTAL", 415, 176, 9, true, rgb(1, 1, 1)); text(money(total), 399, 194, 9, true, rgb(1, 1, 1));
    text("SALESPERSON", 20, 233, 8, true); text(createdBy, 20, 248, 9);

    // Artwork lives below the item name in the same cell, leaving meaningful space for it.
    const cols = [18, 198, 328, 385, 445, 515, 577];
    const drawTableHeader = (headerTop: number) => {
        box(18, headerTop, 559, 24, rgb(0.96, 0.97, 0.99), border, 0.3);
        ["DESCRIPTION", "DETAILS", "QTY", "RATE", "AMOUNT", "GST"].forEach((header, index) => text(header, cols[index] + 4, headerTop + 16, 7.5, true));
    };
    drawTableHeader(262);
    let top = 286;
    for (const row of rows) {
        const image = await embedImage(pdf, row.artwork);
        const names = wrap(row.name, bold, 8.5, cols[1] - cols[0] - 8).slice(0, 2);
        const details = wrap(row.description, regular, 7.5, cols[3] - cols[2] - 8).slice(0, 5);
        const height = Math.max(90, (Math.max(names.length, details.length, 1) * 11) + 18);
        // Keep a guaranteed footer area for totals, payment details, and GST summary.
        if (top + height > 580) {
            page = pdf.addPage([W, H]);
            text("SAMPLE ESTIMATE - CONTINUED", 18, 28, 11, true, navy);
            line(18, 44, 577, navy, 1);
            drawTableHeader(58);
            top = 82;
        }
        box(18, top, 559, height, undefined, border, 0.3);
        if (image) { const size = fit(image, 172, 62); page.drawImage(image, { x: 22 + (172 - size.width) / 2, y: H - top - 24 - size.height, ...size }); }
        names.forEach((item, index) => text(item, 22, top + 15 + index * 11, 8.5, index === 0));
        details.forEach((item, index) => text(item, 203, top + 15 + index * 10, 7.5));
        text(row.qty.toLocaleString("en-SG"), 341, top + 15, 8.5); text(money(row.unitPrice), 390, top + 15, 8.5); text(money(row.amount), 449, top + 15, 8.5); text("SR 9%", 523, top + 15, 7.5);
        top += height;
    }
    // Keep payment, GST and acceptance together. They move as a complete footer when
    // there is not enough space after the final item row.
    let summaryTop = Math.max(top + 14, 500);
    const footerHeight = 300;
    if (summaryTop + footerHeight > H - 20) {
        page = pdf.addPage([W, H]);
        text("ESTIMATE - SUMMARY", 18, 28, 11, true, navy);
        line(18, 44, 577, navy, 1);
        summaryTop = 62;
    }
    text("Payment Details:", 18, summaryTop + 14, 9); text("Payee - NANYANGGIFTS PTE. LTD.", 18, summaryTop + 28, 9); text("Bank - OCBC Bank 551-872-096-001", 18, summaryTop + 42, 9); text("PayNow UEN: 201426646R", 18, summaryTop + 56, 9);
    ([ ["SUBTOTAL", money(subtotal), 9], ["GST TOTAL", money(gst), 9], ["TOTAL", money(total), 15] ] as const).forEach(([label, value, size], index) => { const y = summaryTop + 14 + index * 14 + (index === 2 ? 10 : 0); text(label, 350, y, 9, index === 2, navy); text(value, 565 - bold.widthOfTextAtSize(value, size), y, size, index === 2, index === 2 ? navy : rgb(0, 0, 0)); });
    text("Cancellation fee after order confirmation: 100% of grand total", 18, summaryTop + 82, 8); text("THANK YOU.", 500, summaryTop + 82, 9, true, navy);
    line(18, summaryTop + 96, 577, navy, 0.5);

    // GST is its own section with horizontal guides only, matching the reference style.
    const gstTop = summaryTop + 116;
    text("GST SUMMARY", 18, gstTop, 10, true);
    line(18, gstTop + 16, 577, rgb(0.78, 0.78, 0.78), 0.3);
    ([ ["RATE", "GST", "NET"], ["GST @ 9%", money(gst), money(subtotal)] ] as const).forEach((items, row) => items.forEach((item, index) => text(item, [155, 305, 475][index], gstTop + 35 + row * 21, row === 0 ? 8 : 9, row === 0)));
    line(18, gstTop + 66, 577, rgb(0.78, 0.78, 0.78), 0.3);

    // Leave a clearly separate, unbroken signature area at the actual end of the PDF.
    const acceptanceTop = gstTop + 92;
    text("Accepted By", 18, acceptanceTop, 9);
    text("Accepted Date", 310, acceptanceTop, 9);
    line(18, acceptanceTop + 52, 245, rgb(0.55, 0.55, 0.55), 0.3);
    line(310, acceptanceTop + 52, 537, rgb(0.55, 0.55, 0.55), 0.3);
    text("Signature / name", 18, acceptanceTop + 67, 7, false, slate);
    text("Date", 310, acceptanceTop + 67, 7, false, slate);
    text("Have a nice day!", 250, acceptanceTop + 98, 8, false, slate);
    const pages = pdf.getPages();
    pages.forEach((outputPage, index) => {
        const pageNumber = `${index + 1}/${pages.length}`;
        outputPage.drawText(pageNumber, { x: W - 38 - regular.widthOfTextAtSize(pageNumber, 8), y: 14, size: 8, font: regular, color: slate });
    });
    return Buffer.from(await pdf.save());
}

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { clientId, artworks = [] } = await req.json() as { clientId?: string; artworks?: ArtworkInput[] };
    if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    const { data: client, error } = await supabase.from("clients").select("*, subitems(*)").eq("id", clientId).single();
    if (error || !client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    if (!client.company?.trim()) return NextResponse.json({ error: "Client company name is required" }, { status: 400 });
    const subitems = (client.subitems ?? []).filter((item: any) => ELIGIBLE.has((item.status ?? "").trim())).sort((a: any, b: any) => Number(a.position ?? Number.MAX_SAFE_INTEGER) - Number(b.position ?? Number.MAX_SAFE_INTEGER));
    if (!subitems.length) return NextResponse.json({ error: "No eligible subitems with Quoted, Shortlisted, or Awarded status" }, { status: 400 });
    const artworkById = new Map(artworks.filter((item): item is ArtworkInput => typeof item?.subitemId === "string" && typeof item?.dataUrl === "string").map((item) => [item.subitemId, item.dataUrl]));
    const missing = subitems.find((item: any) => !dataUrlBytes(artworkById.get(item.id) ?? ""));
    if (missing) return NextResponse.json({ error: `Artwork is required for ${missing.name || "each included subitem"}` }, { status: 400 });
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
    const rows = subitems.map((item: any) => { const qty = numberValue(item.qty) || 1; const unitPrice = numberValue(item.up) || (qty > 0 ? numberValue(item.price) / qty : 0); return { name: item.name || "Unnamed item", description: item.description || "", qty, unitPrice, amount: qty * unitPrice, artwork: artworkById.get(item.id) }; });
    const filename = `Sample Estimate - ${String(client.company).replace(/[^a-z0-9]+/gi, " ").trim() || "Client"}.pdf`;
    const createdBy = profile?.full_name?.trim() || profile?.email || "CRM user";
    return NextResponse.json({ ok: true, filename, url: `data:application/pdf;base64,${(await makePdf({ client, rows, createdBy })).toString("base64")}`, createdAt: new Date().toISOString(), createdBy });
}

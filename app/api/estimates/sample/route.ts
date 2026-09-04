/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

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

async function makePdf({ client, rows, createdBy, quotationNumber }: { client: any; rows: EstimateLine[]; createdBy: string; quotationNumber: number }) {
    const pdf = await PDFDocument.create();
    let page = pdf.addPage([W, H]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.204, 0.451, 0.886), paleBlue = rgb(0.839, 0.89, 0.976), slate = rgb(0.4, 0.43, 0.48), border = rgb(0.65, 0.65, 0.65);
    const text = (value: unknown, x: number, top: number, size = 10, isBold = false, color = rgb(0, 0, 0)) => page.drawText(safeText(value), { x, y: H - top - size, size, font: isBold ? bold : regular, color });
    const line = (x1: number, top: number, x2: number, color = navy, thickness = 1) => page.drawLine({ start: { x: x1, y: H - top }, end: { x: x2, y: H - top }, color, thickness });
    const box = (x: number, top: number, width: number, height: number, fill?: ReturnType<typeof rgb>, stroke = border, thickness = 0.3) => page.drawRectangle({ x, y: H - top - height, width, height, color: fill, borderColor: stroke, borderWidth: thickness });
    const centeredText = (value: unknown, x: number, top: number, width: number, size = 10, isBold = false, color = rgb(0, 0, 0)) => {
        const font = isBold ? bold : regular;
        text(value, x + (width - font.widthOfTextAtSize(safeText(value), size)) / 2, top, size, isBold, color);
    };
    const money = (value: number) => `S$${value.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const subtotal = rows.reduce((sum, row) => sum + row.amount, 0), gst = subtotal * 0.09, total = subtotal + gst;

    try {
        const logo = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "logo-with-company-name.png")));
        const size = fit(logo, 185, 70);
        page.drawImage(logo, { x: 20, y: H - 26 - size.height, ...size });
    } catch { text("NanyangGifts Pte. Ltd.", 24, 48, 10, true); }
    ["NanyangGifts Pte. Ltd.", "#07-01, 3 Little Road", "Singapore 536982", "+65 6282 1225", "sales@nanyanggifts.com", "www.nanyanggifts.com", "GST Registration No.: 201426646R", "Company Registration No. 201426646R"].forEach((item, index) => text(item, 225, 24 + index * 12, 8, index === 0));
    const quotationTitle = `Quotation ${quotationNumber}`;
    centeredText(quotationTitle, 400, 49, 177, 16, true, navy);

    // Tight header: the separator now sits directly above the date/total pair.
    line(18, 125, 577, navy, 1.5);
    text("ADDRESS", 20, 132, 8, true);
    [client.company || client.name || "Customer", client.billing_address || "", client.email || "", client.phone || ""].filter(Boolean).slice(0, 4).forEach((item: string, index: number) => text(item, 20, 147 + index * 13, 9));
    box(394, 128, 87, 58, paleBlue, paleBlue, 0);
    centeredText("DATE", 394, 152, 87, 9, true, navy);
    centeredText(new Date().toLocaleDateString("en-GB"), 394, 170, 87, 9);
    box(481, 128, 96, 58, navy, navy, 0);
    centeredText("TOTAL", 481, 152, 96, 9, true, rgb(1, 1, 1));
    centeredText(money(total), 481, 170, 96, 9, true, rgb(1, 1, 1));
    text("SALESPERSON", 20, 202, 8, true); text(createdBy, 20, 217, 9);

    // Artwork lives below the item name in the same cell, leaving meaningful space for it.
    const cols = [18, 220, 381, 419, 475, 535, 577];
    const drawTableHeader = (headerTop: number) => {
        box(18, headerTop, 559, 24, rgb(0.96, 0.97, 0.99), border, 0.3);
        ["DESCRIPTION", "DETAILS", "QTY", "RATE", "AMOUNT", "GST"].forEach((header, index) => centeredText(header, cols[index], headerTop + 8, cols[index + 1] - cols[index], 7.5, true));
    };
    drawTableHeader(231);
    let top = 255;
    for (const row of rows) {
        const image = await embedImage(pdf, row.artwork);
        const descriptionWidth = cols[1] - cols[0] - 8;
        const names = wrap(row.name, bold, 8.5, descriptionWidth);
        const details = wrap(row.description, regular, 7.5, cols[2] - cols[1] - 8);
        // Artwork uses the available Description-column width. Very tall
        // source images retain their aspect ratio but stay within one page.
        const artworkSize = image ? fit(image, descriptionWidth, 220) : null;
        const textHeight = Math.max(names.length * 11, details.length * 10, 11);
        const artworkTopOffset = 20 + names.length * 11;
        const artworkHeight = artworkSize ? artworkTopOffset + artworkSize.height + 8 : 0;
        const height = Math.max(90, textHeight + 28, artworkHeight);
        // Use the full printable page for item rows. The summary is evaluated
        // separately below and moves as a complete block only when necessary.
        if (top + height > H - 36) {
            page = pdf.addPage([W, H]);
            text("QUOTATION - CONTINUED", 18, 28, 11, true, navy);
            line(18, 44, 577, navy, 1);
            drawTableHeader(58);
            top = 82;
        }
        box(18, top, 559, height, undefined, border, 0.3);
        if (image && artworkSize) { page.drawImage(image, { x: cols[0] + 4 + (descriptionWidth - artworkSize.width) / 2, y: H - top - artworkTopOffset - artworkSize.height, ...artworkSize }); }
        names.forEach((item, index) => text(item, 22, top + 15 + index * 11, 8.5, index === 0));
        details.forEach((item, index) => text(item, cols[1] + 5, top + 15 + index * 10, 7.5));
        centeredText(row.qty.toLocaleString("en-SG"), cols[2], top + 15, cols[3] - cols[2], 8.5);
        centeredText(money(row.unitPrice), cols[3], top + 15, cols[4] - cols[3], 8.5);
        centeredText(money(row.amount), cols[4], top + 15, cols[5] - cols[4], 8.5);
        centeredText("SR 9%", cols[5], top + 15, cols[6] - cols[5], 7.5);
        top += height;
    }
    // Keep payment, GST and acceptance together. They move as a complete footer when
    // there is not enough space after the final item row.
    let summaryTop = top + 14;
    const footerHeight = 330;
    if (summaryTop + footerHeight > H - 20) {
        page = pdf.addPage([W, H]);
        text("QUOTATION - SUMMARY", 18, 28, 11, true, navy);
        line(18, 44, 577, navy, 1);
        summaryTop = 42;
    }
    text("Payment Details:", 18, summaryTop + 14, 9); text("Payee - NANYANGGIFTS PTE. LTD.", 18, summaryTop + 28, 9); text("Bank - OCBC Bank 551-872-096-001", 18, summaryTop + 42, 9); text("PayNow UEN: 201426646R", 18, summaryTop + 56, 9);
    text("SUBTOTAL", 350, summaryTop + 14, 9, false, navy);
    text(money(subtotal), 565 - regular.widthOfTextAtSize(money(subtotal), 9), summaryTop + 14, 9);
    text("GST TOTAL", 350, summaryTop + 28, 9, false, navy);
    text(money(gst), 565 - regular.widthOfTextAtSize(money(gst), 9), summaryTop + 28, 9);
    line(350, summaryTop + 42, 577, rgb(0.68, 0.78, 0.96), 0.35);
    text("TOTAL", 350, summaryTop + 50, 11, false, navy);
    text(money(total), 565 - bold.widthOfTextAtSize(money(total), 15), summaryTop + 48, 15, true, navy);
    line(350, summaryTop + 68, 577, rgb(0.38, 0.58, 0.96), 0.8);
    text("Cancellation fee after order confirmation: 100% of grand total", 18, summaryTop + 82, 8); text("THANK YOU.", 500, summaryTop + 82, 9, true, navy);
    line(18, summaryTop + 96, 577, navy, 0.5);

    // GST is its own section with horizontal guides only, matching the reference style.
    const gstTop = summaryTop + 116;
    text("GST SUMMARY", 18, gstTop, 10, true);
    line(18, gstTop + 16, 577, rgb(0.78, 0.78, 0.78), 0.3);
    const gstColumns = [18, 204, 390, 577];
    ["RATE", "GST", "NET"].forEach((label, index) => centeredText(label, gstColumns[index], gstTop + 25, gstColumns[index + 1] - gstColumns[index], 8, true));
    line(18, gstTop + 44, 577, rgb(0.78, 0.78, 0.78), 0.3);
    ["GST @ 9%", money(gst), money(subtotal)].forEach((value, index) => centeredText(value, gstColumns[index], gstTop + 55, gstColumns[index + 1] - gstColumns[index], 9));
    line(18, gstTop + 76, 577, rgb(0.78, 0.78, 0.78), 0.3);

    // Leave a clearly separate, unbroken signature area at the actual end of the PDF.
    const acceptanceTop = gstTop + 102;
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
    const { data: quotationNumber, error: sequenceError } = await supabase.rpc("next_sample_estimate_number");
    if (sequenceError || !Number.isInteger(Number(quotationNumber))) {
        return NextResponse.json({ error: sequenceError?.message || "Could not allocate a quotation number." }, { status: 500 });
    }
    const number = Number(quotationNumber);
    const filename = `Quotation ${number} - ${String(client.company).replace(/[^a-z0-9]+/gi, " ").trim() || "Client"}.pdf`;
    const createdBy = profile?.full_name?.trim() || profile?.email || "CRM user";
    const storagePath = `clients/${clientId}/sample-estimates/${user.id}/${randomUUID()}.pdf`;
    const pdf = await makePdf({ client, rows, createdBy, quotationNumber: number });
    const { error: uploadError } = await supabase.storage.from("crm-files").upload(storagePath, pdf, { contentType: "application/pdf", upsert: false });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
    const url = `/api/files/download?path=${encodeURIComponent(storagePath)}`;
    const { error: activityError } = await supabase.from("activity_log").insert({
        client_id: client.id,
        subitem_id: null,
        actor_name: createdBy,
        action: "estimate_created",
        field_name: null,
        old_value: null,
        new_value: null,
        subitem_name: null,
        link: url,
        title: "generated a sample estimate",
        description: filename,
        meta: { kind: "sample", quotationNumber: number, storagePath, subitemIds: subitems.map((item: any) => item.id) },
        created_at: new Date().toISOString(),
    });
    if (activityError) return NextResponse.json({ error: `Estimate generated, but the activity log could not be updated: ${activityError.message}` }, { status: 500 });
    return NextResponse.json({ ok: true, quotationNumber: number, filename, storagePath, url, createdAt: new Date().toISOString(), createdBy });
}

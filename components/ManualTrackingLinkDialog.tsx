"use client";

import { useEffect, useState } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type LinkKind = "quote" | "invoice";
type Preview = {
  number: string; customer: string | null; customerEmail?: string | null; billingAddress?: string | null;
  date: string | null; dueDate?: string | null; status?: string | null; terms?: string | null; memo?: string | null;
  tax?: number | null; total: number | null; subtotal: number | null; balance?: number | null;
  lines: Array<{ description: string; quantity: number | null; unitPrice: number | null; amount: number | null }>;
  additionalLineCount: number;
};

const amount = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ManualTrackingLinkDialog({ open, onOpenChange, kind, clientId, estimateGenerationId, onLinked }: {
  open: boolean; onOpenChange: (open: boolean) => void; kind: LinkKind; clientId: string;
  estimateGenerationId?: string; onLinked?: () => void;
}) {
  const [number, setNumber] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const isQuote = kind === "quote";
  const noun = isQuote ? "quote" : "invoice";

  useEffect(() => {
    if (!open) { setNumber(""); setPreview(null); setMessage(null); setWorking(false); }
  }, [open]);

  const request = async (phase: "lookup" | "confirm") => {
    if (!number.trim()) { setMessage(`Enter a QuickBooks ${noun} number.`); return; }
    setWorking(true); setMessage(null);
    try {
      const response = await fetch("/api/quickbooks/manual-tracking-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, phase, number: number.trim(), clientId, estimateGenerationId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error ?? `Could not find the ${noun}.`);
      if (phase === "lookup") setPreview(result.preview);
      else { onLinked?.(); onOpenChange(false); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not link the ${noun}.`);
    } finally { setWorking(false); }
  };

  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="max-h-[90vh] w-[calc(100vw-3rem)] max-w-[1280px] overflow-x-hidden overflow-y-auto sm:max-w-[1280px]">
      <AlertDialogHeader>
        <AlertDialogTitle>Link QuickBooks {isQuote ? "quote" : "invoice"}</AlertDialogTitle>
        <AlertDialogDescription>{preview ? `Check the QuickBooks ${noun} below before linking it.` : `Enter the QuickBooks ${noun} number to find it.`}</AlertDialogDescription>
      </AlertDialogHeader>
      {!preview ? <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        QuickBooks {isQuote ? "quote" : "invoice"} number
        <input autoFocus value={number} onChange={(event) => setNumber(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void request("lookup"); } }} disabled={working} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder={isQuote ? "e.g. 8513" : "e.g. 6259"} />
      </label> : <PreviewDetails preview={preview} />}
      {message && <p role="alert" className="text-sm text-red-600">{message}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
        {preview && <button type="button" onClick={() => { setPreview(null); setMessage(null); }} disabled={working} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Change number</button>}
        <button type="button" onClick={() => void request(preview ? "confirm" : "lookup")} disabled={working} className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          {working ? (preview ? "Linking…" : "Finding…") : preview ? `Link ${isQuote ? "quote" : "invoice"}` : `Find ${isQuote ? "quote" : "invoice"}`}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

function PreviewDetails({ preview }: { preview: Preview }) {
  return <div className="space-y-3 rounded-md border border-sky-200 bg-sky-50/60 p-3 text-sm text-slate-700">
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
      <PreviewField label="Number" value={preview.number} strong />
      <PreviewField label="Customer" value={preview.customer} strong />
      <PreviewField label="Date" value={preview.date} />
      {preview.dueDate !== undefined && <PreviewField label="Due date" value={preview.dueDate} />}
      <PreviewField label="Status" value={preview.status} />
      <PreviewField label="Terms" value={preview.terms} />
      <PreviewField label="Customer email" value={preview.customerEmail} />
      <PreviewField label="Total before GST" value={amount(preview.subtotal)} />
      <PreviewField label="GST" value={amount(preview.tax)} />
      <PreviewField label="Total including GST" value={amount(preview.total)} />
      {preview.balance !== undefined && <PreviewField label="Balance" value={amount(preview.balance)} />}
    </div>
    {preview.billingAddress && <PreviewField label="Billing address" value={preview.billingAddress} multiline />}
    {preview.memo && <PreviewField label="Memo" value={preview.memo} multiline />}
    <div className="overflow-hidden rounded border border-sky-200 bg-white">
      <div className="grid grid-cols-[minmax(0,1fr)_70px_90px_100px] border-b border-sky-100 bg-sky-50 px-2 py-1.5 text-xs font-semibold text-slate-600"><span>Line item</span><span className="text-right">Qty</span><span className="text-right">Unit price</span><span className="text-right">Amount</span></div>
      {preview.lines.length ? preview.lines.map((line, index) => <div key={`${line.description}-${index}`} className="grid grid-cols-[minmax(0,1fr)_70px_90px_100px] border-b border-slate-100 px-2 py-1.5 last:border-b-0"><span className="truncate" title={line.description}>{line.description}</span><span className="text-right">{line.quantity ?? "—"}</span><span className="text-right">{amount(line.unitPrice)}</span><span className="text-right font-medium">{amount(line.amount)}</span></div>) : <p className="px-2 py-2 text-slate-500">QuickBooks did not return any item lines.</p>}
      {preview.additionalLineCount > 0 && <p className="border-t border-slate-100 px-2 py-1.5 text-xs text-slate-500">+ {preview.additionalLineCount} more line item{preview.additionalLineCount === 1 ? "" : "s"}</p>}
    </div>
  </div>;
}

function PreviewField({ label, value, strong = false, multiline = false }: { label: string; value: string | null | undefined; strong?: boolean; multiline?: boolean }) {
  return <div className="min-w-0"><div className="text-xs text-slate-500">{label}</div><div className={`${multiline ? "break-words" : "truncate"} ${strong ? "font-semibold" : ""}`} title={value ?? undefined}>{value || "—"}</div></div>;
}

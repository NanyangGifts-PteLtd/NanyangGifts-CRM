"use client";

import { AlertCircle, ChevronRight, LoaderCircle, PackagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SamplesSentClientSummary = {
  activeCount: number;
  notice: "overdue" | "dueSoon" | null;
};

type RecordRow = {
  id: string;
  referenceId: string;
  status: string;
  returnBy: string | null;
  createdAt: string;
  deactivatedAt: string | null;
  items: Array<{ item_name: string; qty: number }>;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB");
}

export function SamplesSentClientSummaryCell({
  clientId,
  clientName,
  displayId,
  summary,
}: {
  clientId: string;
  clientName: string;
  displayId: string;
  summary?: SamplesSentClientSummary;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    void fetch(`/api/samples-sent/summary?clientId=${encodeURIComponent(clientId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Could not load Samples Sent records.");
        if (active) setRecords(data.records ?? []);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load Samples Sent records.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientId, open]);

  const count = summary?.activeCount ?? 0;
  const notice = summary?.notice ?? null;
  const noticeLabel = notice === "overdue" ? "A sample return is overdue" : notice === "dueSoon" ? "A sample return is due within 3 days" : "";
  const openSamplesSentRecord = (recordId: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("panel", "samplessent");
    params.set("sample", recordId);
    window.history.pushState(null, "", `/app?${params.toString()}`);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={`flex h-full w-full items-center justify-center gap-1 px-1 text-[12px] transition hover:brightness-95 ${
          notice === "overdue"
            ? "bg-red-200 text-red-900"
            : notice === "dueSoon"
              ? "bg-amber-200 text-amber-950"
              : "text-sky-700 hover:bg-sky-50 hover:text-sky-800"
        }`}
        title={count ? `View ${count} active Samples Sent record${count === 1 ? "" : "s"}${noticeLabel ? ` — ${noticeLabel}` : ""}` : "View Samples Sent summary"}
      >
        <span className="relative inline-flex shrink-0">
          <PackagePlus size={14} aria-hidden="true" />
        </span>
        <span className="truncate underline underline-offset-2">
          {count ? `${count} sample${count === 1 ? "" : "s"}` : "Samples"}
        </span>
        <ChevronRight size={13} className="shrink-0" aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] w-[92vw] max-w-[1180px] overflow-y-auto bg-white text-slate-800 sm:max-w-[1180px]">
          <DialogHeader>
            <DialogTitle>Samples Sent — {clientName || "Unnamed client"}{displayId ? ` (${displayId})` : ""}</DialogTitle>
            <DialogDescription className="sr-only">
              Active and deactivated Samples Sent records linked to this client.
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="flex min-h-28 items-center justify-center text-sm text-slate-500">
              <LoaderCircle size={17} className="mr-2 animate-spin" /> Loading Samples Sent records…
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : records.length ? (
            <div className="overflow-x-auto rounded-md border border-[#d0d4e4]">
              <div className="grid min-w-[780px] grid-cols-[115px_130px_135px_minmax(400px,1fr)] border-b border-[#d0d4e4] bg-[#f8fafc] text-[11px] text-slate-500">
                <div className="px-3 py-2">Reference ID</div>
                <div className="border-l border-[#d0d4e4] px-3 py-2">Status</div>
                <div className="border-l border-[#d0d4e4] px-3 py-2">Return By</div>
                <div className="border-l border-[#d0d4e4] px-3 py-2">Items Sent</div>
              </div>
              {records.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => openSamplesSentRecord(record.id)}
                  title={`Open ${record.referenceId} on the Samples Sent board`}
                  className={`grid min-w-[780px] grid-cols-[115px_130px_135px_minmax(400px,1fr)] border-b border-[#e1e5ef] text-left text-[12px] last:border-b-0 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 ${record.deactivatedAt ? "bg-slate-50 text-slate-400 line-through" : "bg-white text-slate-700"}`}
                >
                  <div className="px-3 py-2">{record.referenceId}</div>
                  <div className="border-l border-[#e1e5ef] px-3 py-2">{record.status || "—"}</div>
                  <div className="border-l border-[#e1e5ef] px-3 py-2">{formatDate(record.returnBy)}</div>
                  <div className="border-l border-[#e1e5ef] px-3 py-2">{record.items.length ? record.items.map((item) => `${item.item_name} x ${item.qty}`).join(", ") : "—"}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-28 flex-col items-center justify-center text-center text-sm text-slate-500">
              <PackagePlus size={22} className="mb-2 text-slate-400" />
              No Samples Sent records are linked to this client yet.
            </div>
          )}
          {notice && (
            <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${notice === "overdue" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
              <AlertCircle size={16} /> {noticeLabel}.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

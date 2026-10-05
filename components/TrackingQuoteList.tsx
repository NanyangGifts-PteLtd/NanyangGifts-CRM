"use client";

import { ChevronDown, ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  StatusBadge,
  type BadgeOption,
  type BadgeOptionLayout,
} from "@/components/ui/statusbadge";

export const TRACKING_QUOTE_TABLE_MIN_WIDTH = 1870;
export const TRACKING_VIEW_MIN_WIDTH = TRACKING_QUOTE_TABLE_MIN_WIDTH + 80;

const QUOTE_GRID_COLUMNS =
  "minmax(220px, 2fr) 140px 180px 125px 190px 125px 195px 80px 210px 125px 165px 105px";

type TrackingLabelCode =
  | "tracking_summary"
  | "tracking_payment_status"
  | "tracking_price_invoice_match"
  | "tracking_invoice_payment_status";

type Invoice = {
  id: string;
  quickbooks_invoice_doc_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  subtotal: number | null;
  total: number | null;
  balance: number | null;
};

type Quote = {
  id: string;
  title: string | null;
  quickbooks_estimate_doc_number: string | null;
  created_at: string;
  quote_total: number | null;
  quote_subtotal: number | null;
  invoice_total: number | null;
  invoice_subtotal: number | null;
  invoice_count: number;
  total_balance: number | null;
  price_invoice_match: string | null;
  price_invoice_match_option_id: string | null;
  payment_status: string | null;
  invoice_payment_status: string | null;
  invoice_payment_status_option_id: string | null;
  tracking_summary: string | null;
  last_invoice_synced_at: string | null;
  invoices: Invoice[];
};

type QuoteUpdates = {
  trackingSummary?: string;
  paymentStatus?: string;
  priceInvoiceMatch?: string;
  priceInvoiceMatchOptionId?: string | null;
  invoicePaymentStatus?: string;
  invoicePaymentStatusOptionId?: string | null;
};

type TrackingQuoteListProps = {
  clientId: string;
  summaryOptions: BadgeOption[];
  paymentStatusOptions: BadgeOption[];
  matchOptions: BadgeOption[];
  invoicePaymentStatusOptions: BadgeOption[];
  onAddOption?: (code: TrackingLabelCode, name: string) => void | Promise<void>;
  onDeleteOption?: (code: TrackingLabelCode, name: string) => void | Promise<void>;
  onUpdateOptionColor?: (
    code: TrackingLabelCode,
    name: string,
    color: string,
    optionId?: string,
  ) => void | Promise<void>;
  onRenameOption?: (
    code: TrackingLabelCode,
    oldName: string,
    newName: string,
    optionId?: string,
  ) => void | Promise<void>;
  onReorderOptions?: (
    code: TrackingLabelCode,
    layout: BadgeOptionLayout[],
  ) => void | Promise<void>;
};

function amount(value: number | null) {
  return value == null
    ? "—"
    : value.toLocaleString("en-SG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}

export function TrackingQuoteList({
  clientId,
  summaryOptions,
  paymentStatusOptions,
  matchOptions,
  invoicePaymentStatusOptions,
  onAddOption,
  onDeleteOption,
  onUpdateOptionColor,
  onRenameOption,
  onReorderOptions,
}: TrackingQuoteListProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [openQuoteIds, setOpenQuoteIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [syncingQuoteId, setSyncingQuoteId] = useState<string | null>(null);
  const latestQuoteUpdate = useRef(new Map<string, number>());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/quickbooks/tracking-quotes?clientId=${encodeURIComponent(clientId)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result?.error ?? "Could not load quotes");
        if (active) setQuotes(result.quotes ?? []);
      })
      .catch((loadError) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load quotes",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientId, reloadVersion]);

  const syncQuoteInvoices = async (quoteId: string) => {
    setSyncingQuoteId(quoteId);
    setError(null);
    try {
      const response = await fetch("/api/quickbooks/estimate-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateGenerationId: quoteId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result?.error ?? "Could not synchronize invoices");
      setReloadVersion((version) => version + 1);
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Could not synchronize invoices",
      );
    } finally {
      setSyncingQuoteId(null);
    }
  };

  const updateQuote = async (quoteId: string, updates: QuoteUpdates) => {
    const field =
      updates.trackingSummary !== undefined
        ? "summary"
        : updates.paymentStatus !== undefined
          ? "payment"
          : updates.priceInvoiceMatch !== undefined
            ? "match"
            : "invoice-payment";
    const savingKey = `${quoteId}:${field}`;
    const requestId = (latestQuoteUpdate.current.get(savingKey) ?? 0) + 1;
    latestQuoteUpdate.current.set(savingKey, requestId);
    const previousQuote = quotes.find((quote) => quote.id === quoteId);

    setQuotes((current) =>
      current.map((quote) =>
        quote.id === quoteId
          ? {
              ...quote,
              tracking_summary:
                updates.trackingSummary ?? quote.tracking_summary ?? "",
              payment_status:
                updates.paymentStatus ?? quote.payment_status ?? "",
              price_invoice_match:
                updates.priceInvoiceMatch ?? quote.price_invoice_match ?? "",
              price_invoice_match_option_id:
                updates.priceInvoiceMatch !== undefined
                  ? (updates.priceInvoiceMatchOptionId ?? null)
                  : quote.price_invoice_match_option_id,
              invoice_payment_status:
                updates.invoicePaymentStatus ??
                quote.invoice_payment_status ??
                "",
              invoice_payment_status_option_id:
                updates.invoicePaymentStatus !== undefined
                  ? (updates.invoicePaymentStatusOptionId ?? null)
                  : quote.invoice_payment_status_option_id,
            }
          : quote,
      ),
    );
    setError(null);

    try {
      const response = await fetch(`/api/quickbooks/tracking-quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result?.error ?? "Could not update quote");
    } catch (updateError) {
      if (
        latestQuoteUpdate.current.get(savingKey) === requestId &&
        previousQuote
      ) {
        setQuotes((current) =>
          current.map((quote) =>
            quote.id === quoteId
              ? {
                  ...quote,
                  tracking_summary:
                    updates.trackingSummary !== undefined
                      ? previousQuote.tracking_summary
                      : quote.tracking_summary,
                  payment_status:
                    updates.paymentStatus !== undefined
                      ? previousQuote.payment_status
                      : quote.payment_status,
                  price_invoice_match:
                    updates.priceInvoiceMatch !== undefined
                      ? previousQuote.price_invoice_match
                      : quote.price_invoice_match,
                  price_invoice_match_option_id:
                    updates.priceInvoiceMatch !== undefined
                      ? previousQuote.price_invoice_match_option_id
                      : quote.price_invoice_match_option_id,
                  invoice_payment_status:
                    updates.invoicePaymentStatus !== undefined
                      ? previousQuote.invoice_payment_status
                      : quote.invoice_payment_status,
                  invoice_payment_status_option_id:
                    updates.invoicePaymentStatus !== undefined
                      ? previousQuote.invoice_payment_status_option_id
                      : quote.invoice_payment_status_option_id,
                }
              : quote,
          ),
        );
      }
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update quote",
      );
    }
  };

  const labelManagementProps = (code: TrackingLabelCode) => ({
    onAddOption: onAddOption
      ? (name: string) => onAddOption(code, name)
      : undefined,
    onDeleteOption: onDeleteOption
      ? (name: string) => onDeleteOption(code, name)
      : undefined,
    onUpdateOptionColor: onUpdateOptionColor
      ? (name: string, color: string, optionId?: string) =>
          onUpdateOptionColor(code, name, color, optionId)
      : undefined,
    onRenameOption: onRenameOption
      ? (oldName: string, newName: string, optionId?: string) =>
          onRenameOption(code, oldName, newName, optionId)
      : undefined,
    onReorderOptions: onReorderOptions
      ? (layout: BadgeOptionLayout[]) => onReorderOptions(code, layout)
      : undefined,
  });

  if (loading)
    return (
      <div className="flex items-center gap-2 px-3 py-3 text-[12.6px] text-slate-500">
        <LoaderCircle size={14} className="animate-spin" /> Loading quotes…
      </div>
    );
  if (error)
    return <p className="px-3 py-3 text-[12.6px] text-red-600">{error}</p>;
  if (!quotes.length)
    return (
      <p className="px-3 py-3 text-[12.6px] text-slate-500">
        No QuickBooks quotes have been created for this client.
      </p>
    );

  return (
    <div className="min-w-[1870px] overflow-visible border border-[#d0d4e4] bg-white text-[12.6px]">
      <div
        className="grid border-b border-[#d0d4e4] bg-white text-[12.6px] font-medium text-slate-600"
        style={{ gridTemplateColumns: QUOTE_GRID_COLUMNS }}
      >
        <span className="px-3 py-2">Quote</span>
        <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">Summary</span>
        <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">Tracking Status</span>
        <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">Quote total</span>
        <span className="whitespace-nowrap border-l border-[#d0d4e4] px-3 py-2 text-right">Quote total before GST</span>
        <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">Invoice total</span>
        <span className="whitespace-nowrap border-l border-[#d0d4e4] px-3 py-2 text-right">Invoice total before GST</span>
        <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">Invoices</span>
        <span className="whitespace-nowrap border-l border-[#d0d4e4] px-3 py-2 text-center">Price and Invoice Match?</span>
        <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">Total Balance</span>
        <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">Payment Status</span>
        <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">Actions</span>
      </div>

      {quotes.map((quote) => {
        const open = openQuoteIds.has(quote.id);
        const quoteLabel =
          quote.title?.trim() ||
          quote.quickbooks_estimate_doc_number ||
          "Quote without number";

        return (
          <div key={quote.id} className="border-b border-[#d0d4e4] last:border-b-0">
            <div
              className="grid min-h-[36px] text-slate-700"
              style={{ gridTemplateColumns: QUOTE_GRID_COLUMNS }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenQuoteIds((current) => {
                    const next = new Set(current);
                    if (next.has(quote.id)) next.delete(quote.id);
                    else next.add(quote.id);
                    return next;
                  })
                }
                className="flex min-w-0 items-center gap-2 px-3 py-2 text-left font-medium hover:bg-sky-50"
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="truncate">{quoteLabel}</span>
                <span className="shrink-0 text-[12.6px] font-normal text-slate-400">
                  {quote.created_at
                    ? new Date(quote.created_at).toLocaleDateString("en-GB")
                    : ""}
                </span>
              </button>
              <div className="min-w-0 border-l border-[#d0d4e4] p-0">
                <StatusBadge
                  value={quote.tracking_summary ?? ""}
                  options={summaryOptions}
                  small
                  manageLabel="quote summary"
                  onChange={(value) =>
                    void updateQuote(quote.id, { trackingSummary: value })
                  }
                  {...labelManagementProps("tracking_summary")}
                />
              </div>
              <div className="min-w-0 border-l border-[#d0d4e4] p-0">
                <StatusBadge
                  value={quote.payment_status ?? ""}
                  options={paymentStatusOptions}
                  small
                  includeBlankOption={false}
                  manageLabel="quote payment status"
                  onChange={(value) =>
                    void updateQuote(quote.id, { paymentStatus: value })
                  }
                  {...labelManagementProps("tracking_payment_status")}
                />
              </div>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">
                {amount(quote.quote_total)}
              </span>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">
                {amount(quote.quote_subtotal)}
              </span>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">
                {amount(quote.invoice_total)}
              </span>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">
                {amount(quote.invoice_subtotal)}
              </span>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                {quote.invoice_count}
              </span>
              <div className="min-w-0 border-l border-[#d0d4e4] p-0">
                <StatusBadge
                  value={quote.price_invoice_match ?? ""}
                  options={matchOptions}
                  small
                  manageLabel="price and invoice match"
                  onChange={(value) =>
                    void updateQuote(quote.id, {
                      priceInvoiceMatch: value,
                      priceInvoiceMatchOptionId:
                        matchOptions.find((option) => option.value === value)
                          ?.id ?? null,
                    })
                  }
                  {...labelManagementProps("tracking_price_invoice_match")}
                />
              </div>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">
                {amount(quote.total_balance)}
              </span>
              <div className="min-w-0 border-l border-[#d0d4e4] p-0">
                <StatusBadge
                  value={quote.invoice_payment_status ?? ""}
                  options={invoicePaymentStatusOptions}
                  small
                  manageLabel="invoice payment status"
                  onChange={(value) =>
                    void updateQuote(quote.id, {
                      invoicePaymentStatus: value,
                      invoicePaymentStatusOptionId:
                        invoicePaymentStatusOptions.find(
                          (option) => option.value === value,
                        )?.id ?? null,
                    })
                  }
                  {...labelManagementProps("tracking_invoice_payment_status")}
                />
              </div>
              <div className="flex items-center justify-center border-l border-[#d0d4e4] px-1">
                <button
                  type="button"
                  onClick={() => void syncQuoteInvoices(quote.id)}
                  disabled={syncingQuoteId === quote.id}
                  className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[12.6px] font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncingQuoteId === quote.id
                    ? "Synchronizing…"
                    : "Sync invoices"}
                </button>
              </div>
            </div>

            {open && (
              <div className="border-t border-[#d0d4e4] bg-[#f7fbfc] p-3">
                {quote.invoices.length ? (
                  <div className="overflow-hidden border border-[#d0d4e4] bg-white">
                    <div className="grid grid-cols-[2fr_1fr_1fr_1.15fr_1fr_1fr] border-b border-[#d0d4e4] bg-white text-[12.6px] font-medium text-slate-600">
                      <span className="px-3 py-2">Invoice number</span>
                      <span className="border-l border-[#d0d4e4] px-3 py-2">Invoice date</span>
                      <span className="border-l border-[#d0d4e4] px-3 py-2">Due date</span>
                      <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">Invoice total</span>
                      <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">Invoice total before GST</span>
                      <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">Balance</span>
                    </div>
                    {quote.invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="grid min-h-[36px] grid-cols-[2fr_1fr_1fr_1.15fr_1fr_1fr] border-b border-[#d0d4e4] text-slate-700 last:border-b-0"
                      >
                        <span className="px-3 py-2 font-medium">
                          {invoice.quickbooks_invoice_doc_number || "—"}
                        </span>
                        <span className="border-l border-[#d0d4e4] px-3 py-2">
                          {invoice.invoice_date || "—"}
                        </span>
                        <span className="border-l border-[#d0d4e4] px-3 py-2">
                          {invoice.due_date || "—"}
                        </span>
                        <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">
                          {amount(invoice.total)}
                        </span>
                        <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">
                          {amount(invoice.subtotal)}
                        </span>
                        <span className="border-l border-[#d0d4e4] px-3 py-2 text-right">
                          {amount(invoice.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-2 text-slate-500">
                    No invoices are linked to this quote yet.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

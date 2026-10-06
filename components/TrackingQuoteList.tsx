"use client";

import { ChevronDown, ChevronRight, LoaderCircle } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  StatusBadge,
  type BadgeOption,
  type BadgeOptionLayout,
} from "@/components/ui/statusbadge";
import { ManualTrackingLinkDialog } from "@/components/ManualTrackingLinkDialog";

export const TRACKING_QUOTE_TABLE_MIN_WIDTH = 1975;
export const TRACKING_VIEW_MIN_WIDTH = TRACKING_QUOTE_TABLE_MIN_WIDTH + 80;

const QUOTE_COLUMN_DEFINITIONS = [
  { key: "quote", width: 230, minWidth: 220 },
  { key: "summary", width: 140, minWidth: 100 },
  { key: "trackingStatus", width: 180, minWidth: 130 },
  { key: "quoteTotal", width: 125, minWidth: 100 },
  { key: "quoteSubtotal", width: 190, minWidth: 150 },
  { key: "invoiceTotal", width: 125, minWidth: 100 },
  { key: "invoiceSubtotal", width: 195, minWidth: 150 },
  { key: "invoices", width: 80, minWidth: 70 },
  { key: "match", width: 210, minWidth: 160 },
  { key: "totalBalance", width: 125, minWidth: 105 },
  { key: "paymentStatus", width: 165, minWidth: 125 },
  { key: "actions", width: 210, minWidth: 180 },
] as const;

const INVOICE_COLUMN_DEFINITIONS = [
  { key: "number", width: 550, minWidth: 220 },
  { key: "date", width: 275, minWidth: 120 },
  { key: "dueDate", width: 275, minWidth: 120 },
  { key: "total", width: 320, minWidth: 130 },
  { key: "subtotal", width: 275, minWidth: 170 },
  { key: "balance", width: 275, minWidth: 120 },
] as const;

type ResizableColumn = {
  key: string;
  width: number;
  minWidth: number;
};

const defaultWidths = (columns: readonly ResizableColumn[]) =>
  Object.fromEntries(columns.map((column) => [column.key, column.width]));

const normalizedWidths = (
  columns: readonly ResizableColumn[],
  value: unknown,
) => {
  if (!value || typeof value !== "object") return defaultWidths(columns);
  const saved = value as Record<string, unknown>;
  return Object.fromEntries(
    columns.map((column) => [
      column.key,
      typeof saved[column.key] === "number" &&
      Number.isFinite(saved[column.key])
        ? Math.max(column.minWidth, saved[column.key] as number)
        : column.width,
    ]),
  );
};

function ColumnResizeHandle({
  label,
  onPointerDown,
}: {
  label: string;
  onPointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span
      role="separator"
      aria-label={`Resize ${label} column`}
      onPointerDown={onPointerDown}
      onDragStart={(event) => event.preventDefault()}
      className="absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize border-l border-transparent hover:border-sky-400"
    />
  );
}

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
  onQuotesChanged?: () => void;
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
  onQuotesChanged,
}: TrackingQuoteListProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [openQuoteIds, setOpenQuoteIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [syncingQuoteId, setSyncingQuoteId] = useState<string | null>(null);
  const [linkInvoiceQuoteId, setLinkInvoiceQuoteId] = useState<string | null>(null);
  const [quoteColumnWidths, setQuoteColumnWidths] = useState<
    Record<string, number>
  >(() => defaultWidths(QUOTE_COLUMN_DEFINITIONS));
  const [invoiceColumnWidths, setInvoiceColumnWidths] = useState<
    Record<string, number>
  >(() => defaultWidths(INVOICE_COLUMN_DEFINITIONS));
  const latestQuoteUpdate = useRef(new Map<string, number>());

  const quoteGridColumns = useMemo(
    () =>
      QUOTE_COLUMN_DEFINITIONS.map(
        (column) => `${quoteColumnWidths[column.key] ?? column.width}px`,
      ).join(" "),
    [quoteColumnWidths],
  );
  const quoteTableWidth = useMemo(
    () =>
      QUOTE_COLUMN_DEFINITIONS.reduce(
        (total, column) =>
          total + (quoteColumnWidths[column.key] ?? column.width),
        0,
      ),
    [quoteColumnWidths],
  );
  const invoiceGridColumns = useMemo(
    () =>
      INVOICE_COLUMN_DEFINITIONS.map(
        (column) => `${invoiceColumnWidths[column.key] ?? column.width}px`,
      ).join(" "),
    [invoiceColumnWidths],
  );
  const invoiceTableWidth = useMemo(
    () =>
      INVOICE_COLUMN_DEFINITIONS.reduce(
        (total, column) =>
          total + (invoiceColumnWidths[column.key] ?? column.width),
        0,
      ),
    [invoiceColumnWidths],
  );

  useEffect(() => {
    const loadWidths = async () => {
      try {
        const localQuote = JSON.parse(
          window.localStorage.getItem("colWidths:tracking-quotes:local") ??
            "null",
        );
        const localInvoice = JSON.parse(
          window.localStorage.getItem("colWidths:tracking-invoices:local") ??
            "null",
        );
        setQuoteColumnWidths(
          normalizedWidths(QUOTE_COLUMN_DEFINITIONS, localQuote),
        );
        setInvoiceColumnWidths(
          normalizedWidths(INVOICE_COLUMN_DEFINITIONS, localInvoice),
        );
      } catch {
        // Invalid browser storage should not stop the Tracking View loading.
      }

      try {
        const { loadUserSetting } = await import("@/lib/user-settings");
        const [savedQuote, savedInvoice] = await Promise.all([
          loadUserSetting("colWidths:tracking-quotes"),
          loadUserSetting("colWidths:tracking-invoices"),
        ]);
        if (savedQuote && typeof savedQuote === "object") {
          setQuoteColumnWidths(
            normalizedWidths(QUOTE_COLUMN_DEFINITIONS, savedQuote),
          );
        }
        if (savedInvoice && typeof savedInvoice === "object") {
          setInvoiceColumnWidths(
            normalizedWidths(INVOICE_COLUMN_DEFINITIONS, savedInvoice),
          );
        }
      } catch (loadError) {
        console.warn("Failed to load Tracking table column widths", loadError);
      }
    };
    void loadWidths();
  }, []);

  const resizeColumn = (
    table: "quote" | "invoice",
    column: ResizableColumn,
    startX: number,
  ) => {
    const setWidths =
      table === "quote" ? setQuoteColumnWidths : setInvoiceColumnWidths;
    const storageKey =
      table === "quote"
        ? "colWidths:tracking-quotes"
        : "colWidths:tracking-invoices";
    const initialWidths =
      table === "quote" ? quoteColumnWidths : invoiceColumnWidths;
    const startWidth = initialWidths[column.key] ?? column.width;

    const onMove = (event: PointerEvent) => {
      const width = Math.max(column.minWidth, startWidth + event.clientX - startX);
      setWidths((current) => ({ ...current, [column.key]: width }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setWidths((current) => {
        try {
          window.localStorage.setItem(`${storageKey}:local`, JSON.stringify(current));
        } catch {
          // Server persistence below still gives signed-in users a fallback.
        }
        void import("@/lib/user-settings")
          .then(({ saveUserSetting }) => saveUserSetting(storageKey, current))
          .catch((saveError) =>
            console.warn("Failed to save Tracking table column widths", saveError),
          );
        return current;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

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
    <div
      className="overflow-visible border border-[#d0d4e4] bg-white text-[12.6px]"
      style={{ minWidth: quoteTableWidth }}
    >
      <div
        className="grid border-b border-[#d0d4e4] bg-white text-[12.6px] font-medium text-slate-600"
        style={{ gridTemplateColumns: quoteGridColumns }}
      >
        {[
          "Quote",
          "Summary",
          "Tracking Status",
          "Quote total",
          "Quote total before GST",
          "Invoice total",
          "Invoice total before GST",
          "Invoices",
          "Price and Invoice Match?",
          "Total Balance",
          "Payment Status",
          "Invoice Actions",
        ].map((label, index) => {
          const column = QUOTE_COLUMN_DEFINITIONS[index];
          return (
            <span
              key={column.key}
              className={`relative px-3 py-2 text-center ${
                index > 0 ? "border-l border-[#d0d4e4]" : ""
              } ${index === 4 || index === 6 || index === 8 || index === 11 ? "whitespace-nowrap" : ""}`}
            >
              {label}
              <ColumnResizeHandle
                label={label}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  resizeColumn("quote", column, event.clientX);
                }}
              />
            </span>
          );
        })}
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
              style={{ gridTemplateColumns: quoteGridColumns }}
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
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                {amount(quote.quote_total)}
              </span>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                {amount(quote.quote_subtotal)}
              </span>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                {amount(quote.invoice_total)}
              </span>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
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
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
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
              <div className="flex items-center justify-center gap-1 border-l border-[#d0d4e4] px-1 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setLinkInvoiceQuoteId(quote.id)}
                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[12.6px] font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  Link Invoice
                </button>
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
                  <div
                    className="inline-block overflow-hidden border border-[#d0d4e4] bg-white align-top"
                    style={{ minWidth: invoiceTableWidth }}
                  >
                    <div
                      className="grid border-b border-[#d0d4e4] bg-white text-[12.6px] font-medium text-slate-600"
                      style={{ gridTemplateColumns: invoiceGridColumns }}
                    >
                      {[
                        "Invoice number",
                        "Invoice date",
                        "Due date",
                        "Invoice total",
                        "Invoice total before GST",
                        "Balance",
                      ].map((label, index) => {
                        const column = INVOICE_COLUMN_DEFINITIONS[index];
                        return (
                          <span
                            key={column.key}
                            className={`relative px-3 py-2 text-center ${
                              index > 0 ? "border-l border-[#d0d4e4]" : ""
                            } ${index === 4 ? "whitespace-nowrap" : ""}`}
                          >
                            {label}
                            <ColumnResizeHandle
                              label={label}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                resizeColumn("invoice", column, event.clientX);
                              }}
                            />
                          </span>
                        );
                      })}
                    </div>
                    {quote.invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="grid min-h-[36px] border-b border-[#d0d4e4] text-slate-700 last:border-b-0"
                        style={{ gridTemplateColumns: invoiceGridColumns }}
                      >
                        <span className="px-3 py-2 text-center font-medium">
                          {invoice.quickbooks_invoice_doc_number || "—"}
                        </span>
                        <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                          {invoice.invoice_date || "—"}
                        </span>
                        <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                          {invoice.due_date || "—"}
                        </span>
                        <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                          {amount(invoice.total)}
                        </span>
                        <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                          {amount(invoice.subtotal)}
                        </span>
                        <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
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
      <ManualTrackingLinkDialog
        open={Boolean(linkInvoiceQuoteId)}
        onOpenChange={(open) => {
          if (!open) setLinkInvoiceQuoteId(null);
        }}
        kind="invoice"
        clientId={clientId}
        estimateGenerationId={linkInvoiceQuoteId ?? undefined}
        onLinked={() => {
          setReloadVersion((version) => version + 1);
          onQuotesChanged?.();
        }}
      />
    </div>
  );
}

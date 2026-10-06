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
import { EditableCell } from "@/components/ui/editablecell";
import { ManualTrackingLinkDialog } from "@/components/ManualTrackingLinkDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const TRACKING_QUOTE_TABLE_MIN_WIDTH = 2095;
export const TRACKING_VIEW_MIN_WIDTH = TRACKING_QUOTE_TABLE_MIN_WIDTH + 80;

const QUOTE_COLUMN_DEFINITIONS = [
  { key: "quote", width: 230, minWidth: 220 },
  { key: "summary", width: 140, minWidth: 100 },
  { key: "trackingStatus", width: 180, minWidth: 130 },
  { key: "remarks", width: 240, minWidth: 140 },
  { key: "quoteSubtotal", width: 190, minWidth: 150 },
  { key: "quoteTotal", width: 125, minWidth: 100 },
  { key: "invoiceSubtotal", width: 195, minWidth: 150 },
  { key: "invoiceTotal", width: 125, minWidth: 100 },
  { key: "invoices", width: 80, minWidth: 70 },
  { key: "totalBalance", width: 125, minWidth: 105 },
  { key: "paymentStatus", width: 165, minWidth: 125 },
  { key: "actions", width: 300, minWidth: 270 },
] as const;

const INVOICE_COLUMN_DEFINITIONS = [
  { key: "number", width: 550, minWidth: 220 },
  { key: "date", width: 275, minWidth: 120 },
  { key: "dueDate", width: 275, minWidth: 120 },
  { key: "subtotal", width: 275, minWidth: 170 },
  { key: "total", width: 320, minWidth: 130 },
  { key: "balance", width: 275, minWidth: 120 },
  { key: "actions", width: 135, minWidth: 115 },
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
  link_source: "quickbooks" | "manual" | null;
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
  payment_status: string | null;
  invoice_payment_status: string | null;
  invoice_payment_status_option_id: string | null;
  tracking_summary: string | null;
  tracking_remarks: string | null;
  last_invoice_synced_at: string | null;
  link_source: "quickbooks" | "manual" | null;
  invoices: Invoice[];
};

type QuoteUpdates = {
  trackingSummary?: string;
  trackingRemarks?: string;
  paymentStatus?: string;
  invoicePaymentStatus?: string;
  invoicePaymentStatusOptionId?: string | null;
};

type TrackingQuoteListProps = {
  clientId: string;
  canEdit: boolean;
  summaryOptions: BadgeOption[];
  paymentStatusOptions: BadgeOption[];
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
  canEdit,
  summaryOptions,
  paymentStatusOptions,
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
  const [unlinkTarget, setUnlinkTarget] = useState<
    | { kind: "quote"; quoteId: string; label: string }
    | { kind: "invoice"; quoteId: string; invoiceId: string; label: string }
    | null
  >(null);
  const [unlinking, setUnlinking] = useState(false);
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
    if (!canEdit) return;
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

  const unlink = async () => {
    if (!unlinkTarget || !canEdit) return;
    setUnlinking(true);
    setError(null);
    try {
      const response = await fetch("/api/quickbooks/manual-tracking-link", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: unlinkTarget.kind,
          clientId,
          estimateGenerationId: unlinkTarget.quoteId,
          ...(unlinkTarget.kind === "invoice"
            ? { invoiceId: unlinkTarget.invoiceId }
            : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error ?? "Could not unlink the QuickBooks record");
      }
      setUnlinkTarget(null);
      setReloadVersion((version) => version + 1);
      onQuotesChanged?.();
    } catch (unlinkError) {
      setError(
        unlinkError instanceof Error
          ? unlinkError.message
          : "Could not unlink the QuickBooks record",
      );
    } finally {
      setUnlinking(false);
    }
  };

  const updateQuote = async (quoteId: string, updates: QuoteUpdates) => {
    if (!canEdit) return;
    const field =
      updates.trackingSummary !== undefined
        ? "summary"
        : updates.trackingRemarks !== undefined
          ? "remarks"
          : updates.paymentStatus !== undefined
            ? "payment"
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
              tracking_remarks:
                updates.trackingRemarks ?? quote.tracking_remarks ?? "",
              payment_status:
                updates.paymentStatus ?? quote.payment_status ?? "",
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
                  tracking_remarks:
                    updates.trackingRemarks !== undefined
                      ? previousQuote.tracking_remarks
                      : quote.tracking_remarks,
                  payment_status:
                    updates.paymentStatus !== undefined
                      ? previousQuote.payment_status
                      : quote.payment_status,
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
          "Remarks",
          "Quote total before GST",
          "Quote total",
          "Invoice total before GST",
          "Invoice total",
          "Invoices",
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
              } ${index === 4 || index === 6 || index === 11 ? "whitespace-nowrap" : ""}`}
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
                  readOnly={!canEdit}
                  readOnlyReason="You can only edit items that are assigned to you"
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
                  readOnly={!canEdit}
                  readOnlyReason="You can only edit items that are assigned to you"
                  manageLabel="quote payment status"
                  onChange={(value) =>
                    void updateQuote(quote.id, { paymentStatus: value })
                  }
                  {...labelManagementProps("tracking_payment_status")}
                />
              </div>
              <div className="relative min-w-0 overflow-visible border-l border-[#d0d4e4] p-0 focus-within:z-[80]">
                <EditableCell
                  value={quote.tracking_remarks ?? ""}
                  onChange={(value) =>
                    void updateQuote(quote.id, { trackingRemarks: value })
                  }
                  readOnly={!canEdit}
                  readOnlyReason="You can only edit items that are assigned to you"
                  multiline
                  resizableMultiline
                  className="!justify-start"
                />
              </div>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                {amount(quote.quote_subtotal)}
              </span>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                {amount(quote.quote_total)}
              </span>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                {amount(quote.invoice_subtotal)}
              </span>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                {amount(quote.invoice_total)}
              </span>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                {quote.invoice_count}
              </span>
              <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                {amount(quote.total_balance)}
              </span>
              <div className="min-w-0 border-l border-[#d0d4e4] p-0">
                <StatusBadge
                  value={quote.invoice_payment_status ?? ""}
                  options={invoicePaymentStatusOptions}
                  small
                  readOnly={!canEdit}
                  readOnlyReason="You can only edit items that are assigned to you"
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
                  disabled={!canEdit}
                  onClick={() => setLinkInvoiceQuoteId(quote.id)}
                  title={
                    canEdit
                      ? "Link an invoice"
                      : "You can only edit items that are assigned to you"
                  }
                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[12.6px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Link Invoice
                </button>
                <button
                  type="button"
                  onClick={() => void syncQuoteInvoices(quote.id)}
                  disabled={!canEdit || syncingQuoteId === quote.id}
                  title={
                    canEdit
                      ? "Synchronize linked invoices"
                      : "You can only edit items that are assigned to you"
                  }
                  className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[12.6px] font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncingQuoteId === quote.id
                    ? "Synchronizing…"
                    : "Sync invoices"}
                </button>
                {quote.link_source === "manual" && (
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      setUnlinkTarget({
                        kind: "quote",
                        quoteId: quote.id,
                        label: quoteLabel,
                      })
                    }
                    title={
                      canEdit
                        ? "Unlink this manually linked quote"
                        : "You can only edit items that are assigned to you"
                    }
                    className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[12.6px] font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Unlink Quote
                  </button>
                )}
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
                        "Invoice total before GST",
                        "Invoice total",
                        "Balance",
                        "Actions",
                      ].map((label, index) => {
                        const column = INVOICE_COLUMN_DEFINITIONS[index];
                        return (
                          <span
                            key={column.key}
                            className={`relative px-3 py-2 text-center ${
                              index > 0 ? "border-l border-[#d0d4e4]" : ""
                            } ${index === 3 ? "whitespace-nowrap" : ""}`}
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
                          {amount(invoice.subtotal)}
                        </span>
                        <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                          {amount(invoice.total)}
                        </span>
                        <span className="border-l border-[#d0d4e4] px-3 py-2 text-center">
                          {amount(invoice.balance)}
                        </span>
                        <div className="flex items-center justify-center border-l border-[#d0d4e4] px-2">
                          {invoice.link_source === "manual" && (
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() =>
                                setUnlinkTarget({
                                  kind: "invoice",
                                  quoteId: quote.id,
                                  invoiceId: invoice.id,
                                  label:
                                    invoice.quickbooks_invoice_doc_number ??
                                    "this invoice",
                                })
                              }
                              title={
                                canEdit
                                  ? "Unlink this manually linked invoice"
                                  : "You can only edit items that are assigned to you"
                              }
                              className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[12.6px] font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Unlink
                            </button>
                          )}
                        </div>
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
        open={canEdit && Boolean(linkInvoiceQuoteId)}
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
      <AlertDialog
        open={Boolean(unlinkTarget)}
        onOpenChange={(open) => {
          if (!open && !unlinking) setUnlinkTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Unlink {unlinkTarget?.kind === "quote" ? "quote" : "invoice"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {unlinkTarget?.label ?? "this record"} from this
              client&apos;s Tracking View. It will not delete the record in
              QuickBooks or change any links between records in QuickBooks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={unlinking}
              onClick={(event) => {
                event.preventDefault();
                void unlink();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {unlinking ? "Unlinking…" : "Unlink"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LockKeyhole,
  LoaderCircle,
  History,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Client, CRMGroup, Profile } from "@/app/types";
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
import {
  AssigneeMultiSelect,
  gradientForId,
} from "@/components/ui/assignee-multiselect";
import {
  StatusBadge,
  type BadgeOptionLayout,
} from "@/components/ui/statusbadge";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { uploadCrmFiles } from "@/lib/crm-files";
import { FilePreview } from "@/components/ui/file-preview";
import { FileDropTarget } from "@/components/ui/file-drop-target";
import { AWARDED_OR_LATER_SUBITEM_STATUS_SYSTEM_KEYS } from "@/lib/board-labels";
import {
  fetchHydratedClientBundle,
  fetchHydratedClientGroupPage,
} from "@/lib/crm";

type AdditionalCost = {
  id: string;
  client_id: string;
  linkedClient?: {
    id: string;
    name: string;
    displayId: string;
    deletedAt?: string | null;
  } | null;
  date_sent: string | null;
  people_id: string | null;
  people_ids?: string[];
  cost: number | null;
  order_number?: string | null;
  mode_of_payment?: string | null;
  mode_of_payment_option_id?: string | null;
  remarks: string;
  status: string;
  status_option_id?: string | null;
  reason: string;
  reason_option_id?: string | null;
  courier: string;
  courier_option_id?: string | null;
  trip_id: string;
  items_sent: string;
  related_subitem_ids?: string[] | null;
  qty: string;
  verified: boolean | null;
  discussed: boolean | null;
  created_at: string;
  created_by?: string | null;
  has_quickbooks_bill?: boolean;
  quickbooks_invoice_number?: string;
  quickbooks_supplier_id?: string;
  quickbooks_supplier_name?: string;
  quickbooks_memo?: string | null;
  quickbooks_overall_gst_override?: number | null;
  quickbooks_bill_id?: string | null;
  quickbooks_bill_sync_error?: string | null;
  isGeneratingQuickBooksBill?: boolean;
  quickbooks_attachment_files?: Array<{
    name?: string;
    id?: string;
    contentType?: string;
    url?: string;
    storagePath?: string;
  }>;
  voucher_group?: "courier" | "other" | "quickbooks_bills_only";
  is_draft?: boolean;
  draft_bill?: {
    supplierId?: string;
    supplierName?: string;
    mailingAddress?: string;
    termId?: string;
    billDate?: string;
    dueDate?: string;
    billNumber?: string;
    memo?: string;
    overallGstAmount?: string;
    lines?: Array<{
      categoryId?: string;
      categoryName?: string;
      description?: string;
      amount?: string;
      taxCodeId?: string;
    }>;
    attachmentFiles?: StoredDraftAttachment[];
  } | null;
  draft_ocr?: {
    confidence?: Record<string, number>;
    prefillFileName?: string;
    supplierExtraction?: {
      name?: string;
      suggestion?: { id: string; name: string };
    };
  } | null;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  can_edit?: boolean;
  can_deactivate?: boolean;
};
type StoredDraftAttachment = {
  id?: string;
  name: string;
  url: string;
  storagePath: string;
  mimeType?: string;
};
type LabelOption = {
  id?: string;
  value: string;
  color: string;
  section?: number;
  systemKey?: string | null;
};
type Props = {
  clients: Client[];
  profiles: Profile[];
  groups: CRMGroup[];
  currentUserId?: string | null;
  currentUserRole?: string | null;
  clientAssignees: Record<string, string[]>;
  clientPmAssignees: Record<string, string[]>;
  onOpenProject?: (clientId: string) => void;
};
type Column = { key: string; label: string; width: number };
const initialColumns: Column[] = [
  { key: "activity", label: "", width: 52 },
  { key: "project", label: "Project Name", width: 250 },
  { key: "cost", label: "Cost", width: 115 },
  { key: "reason", label: "Reason", width: 155 },
  { key: "remarks", label: "Remarks", width: 260 },
  { key: "trip_id", label: "Reference ID", width: 145 },
  { key: "items_sent", label: "Related Subitems", width: 210 },
  { key: "courier", label: "Courier", width: 140 },
  { key: "created", label: "Date Created", width: 140 },
  { key: "actions", label: "Actions", width: 190 },
  { key: "deactivate", label: "Deactivate", width: 120 },
];
const otherVoucherColumns: Column[] = [
  { key: "activity", label: "", width: 52 },
  { key: "project", label: "Project Name", width: 250 },
  { key: "cost", label: "Cost", width: 115 },
  { key: "reason", label: "Reason", width: 155 },
  { key: "remarks", label: "Remarks", width: 260 },
  { key: "trip_id", label: "Reference ID", width: 145 },
  { key: "items_sent", label: "Related Subitems", width: 210 },
  { key: "has_quickbooks_bill", label: "Has QuickBooks Bill?", width: 165 },
  {
    key: "quickbooks_invoice_number",
    label: "Invoice No. (Bill No.)",
    width: 185,
  },
  { key: "quickbooks_supplier_name", label: "Supplier", width: 220 },
  { key: "quickbooks_memo", label: "Memo", width: 280 },
  {
    key: "quickbooks_overall_gst_override",
    label: "GST Amount",
    width: 165,
  },
  { key: "quickbooks_total_cost", label: "Total Cost", width: 145 },
  { key: "quickbooks_attachment_files", label: "Attached Files", width: 240 },
  { key: "bill_action", label: "Bill Action", width: 125 },
  { key: "created", label: "Date Created", width: 140 },
  { key: "actions", label: "Actions", width: 190 },
  { key: "deactivate", label: "Deactivate", width: 120 },
];
const quickBooksBillsOnlyColumns: Column[] = [
  { key: "activity", label: "", width: 52 },
  { key: "cost", label: "Cost", width: 115 },
  { key: "trip_id", label: "Reference ID", width: 145 },
  { key: "has_quickbooks_bill", label: "Has QuickBooks Bill?", width: 165 },
  { key: "quickbooks_supplier_name", label: "Supplier", width: 220 },
  { key: "quickbooks_memo", label: "Memo", width: 280 },
  {
    key: "quickbooks_invoice_number",
    label: "Invoice No. (Bill No.)",
    width: 185,
  },
  {
    key: "quickbooks_overall_gst_override",
    label: "GST Amount",
    width: 165,
  },
  { key: "quickbooks_total_cost", label: "Total Cost", width: 145 },
  { key: "quickbooks_attachment_files", label: "Attached Files", width: 240 },
  { key: "bill_action", label: "Bill Action", width: 125 },
  { key: "created", label: "Date Created", width: 140 },
  { key: "actions", label: "Deactivate", width: 110 },
];
const allVoucherColumns = Array.from(
  new Map(
    [
      ...initialColumns,
      ...otherVoucherColumns,
      ...quickBooksBillsOnlyColumns,
    ].map((column) => [column.key, column]),
  ).values(),
);
type VoucherGroupId = "courier" | "other" | "quickbooks_bills_only";
type VoucherColumnLayout = { order: string[]; widths: Record<string, number> };
const defaultVoucherColumnLayout = (
  baseColumns: Column[],
): VoucherColumnLayout => ({
  order: baseColumns.map((column) => column.key),
  widths: Object.fromEntries(
    baseColumns.map((column) => [column.key, column.width]),
  ),
});
const cellClass =
  "h-10 min-w-0 bg-white px-2 text-sm text-slate-700 outline-none focus:bg-sky-50 focus:ring-1 focus:ring-inset focus:ring-sky-400";
const hiddenBillGstCodeNames = new Set(["sr9%", "txrc-ess"]);
const clientLabel = (client: Client) =>
  `${client.name || "Unnamed client"}${client.displayId ? ` · ${client.displayId}` : ""}`;
const linkedClientLabel = (client: NonNullable<AdditionalCost["linkedClient"]>) =>
  `${client.name || "Unnamed client"}${client.displayId ? ` · ${client.displayId}` : ""}`;
// Keep chooser order consistent with the CRM Board's default client sort:
// newest created clients first within each group.
const compareByDefaultClientBoardOrder = (first: Client, second: Client) =>
  new Date(second.createdAt || 0).getTime() -
  new Date(first.createdAt || 0).getTime();
const PAYMENT_VOUCHER_CLIENT_PAGE_SIZE = 30;

function CreatorDate({
  createdAt,
  createdBy,
  profiles,
}: {
  createdAt: string;
  createdBy?: string | null;
  profiles: Profile[];
}) {
  const profile = createdBy
    ? profiles.find((candidate) => candidate.id === createdBy)
    : null;
  const label = profile?.full_name?.trim() || profile?.email || "Unknown user";
  const initials = (() => {
    const parts = label.split(/\s+/).filter(Boolean);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : label.slice(0, 2).toUpperCase();
  })();
  const timestamp = new Date(createdAt);
  const tooltip = `${timestamp.toLocaleString("en-SG")}${createdBy ? ` · Created by ${label}` : ""}`;

  return (
    <div title={tooltip} className="flex h-10 items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
      {createdBy ? (
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
          style={{ background: gradientForId(createdBy, profile?.avatar_color) }}
          aria-label={`Created by ${label}`}
        >
          {initials || "U"}
        </span>
      ) : null}
      <span>{timestamp.toLocaleDateString("en-SG")}</span>
    </div>
  );
}
const supplierSearchKey = (value: string) =>
  value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
const levenshteinDistance = (first: string, second: string) => {
  const previous = Array.from(
    { length: second.length + 1 },
    (_, index) => index,
  );
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    let diagonal = previous[0];
    previous[0] = firstIndex;
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const saved = previous[secondIndex];
      previous[secondIndex] = Math.min(
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + 1,
        diagonal + Number(first[firstIndex - 1] !== second[secondIndex - 1]),
      );
      diagonal = saved;
    }
  }
  return previous[second.length];
};
const closestQuickBooksOption = <T extends { id: string; name: string }>(
  value: string,
  options: T[],
) => {
  const query = supplierSearchKey(value);
  if (!query) return null;
  return (
    options
      .map((option) => ({
        option,
        score:
          levenshteinDistance(supplierSearchKey(option.name), query) /
          Math.max(supplierSearchKey(option.name).length, query.length, 1),
      }))
      .sort((first, second) => first.score - second.score)[0]?.option ?? null
  );
};

export function AdditionalCostsBoard({
  clients,
  profiles,
  groups,
  currentUserId,
  currentUserRole,
  clientAssignees,
  clientPmAssignees,
  onOpenProject,
}: Props) {
  const [rows, setRows] = useState<AdditionalCost[]>([]);
  const [collapsedVoucherGroups, setCollapsedVoucherGroups] = useState<
    Record<VoucherGroupId, boolean>
  >({
    courier: false,
    other: false,
    quickbooks_bills_only: false,
  });
  const [labelOptions, setLabelOptions] = useState<
    Record<string, LabelOption[]>
  >({});
  const columns = allVoucherColumns;
  const [voucherColumnLayouts, setVoucherColumnLayouts] = useState<
    Record<VoucherGroupId, VoucherColumnLayout>
  >({
    courier: defaultVoucherColumnLayout(initialColumns),
    other: defaultVoucherColumnLayout(otherVoucherColumns),
    quickbooks_bills_only: defaultVoucherColumnLayout(
      quickBooksBillsOnlyColumns,
    ),
  });
  const [draggedVoucherColumn, setDraggedVoucherColumn] = useState<{
    group: VoucherGroupId;
    key: string;
  } | null>(null);
  const [voucherDropTarget, setVoucherDropTarget] = useState<{
    group: VoucherGroupId;
    key: string;
    edge: "left" | "right";
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [relatedSubitemsOpen, setRelatedSubitemsOpen] = useState(false);
  const [boardRelatedSubitemsMenu, setBoardRelatedSubitemsMenu] = useState<{
    rowId: string;
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerClients, setPickerClients] = useState<Client[]>([]);
  const [pickerClientAssignees, setPickerClientAssignees] = useState<
    Record<string, string[]>
  >({});
  const [pickerClientPmAssignees, setPickerClientPmAssignees] = useState<
    Record<string, string[]>
  >({});
  const [pickerClientTotal, setPickerClientTotal] = useState(0);
  const [pickerClientOffset, setPickerClientOffset] = useState(0);
  const [pickerClientsLoading, setPickerClientsLoading] = useState(false);
  const [pickerClientsLoadingMore, setPickerClientsLoadingMore] =
    useState(false);
  const pickerClientRequest = useRef(0);
  const [expandedPickerGroups, setExpandedPickerGroups] = useState<Set<string>>(
    new Set(),
  );
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [selectedVoucherClientId, setSelectedVoucherClientId] = useState<
    string | null
  >(null);
  const [voucherCreationGroup, setVoucherCreationGroup] =
    useState<VoucherGroupId>("courier");
  const [otherBillChoice, setOtherBillChoice] = useState<"add" | "none" | null>(
    null,
  );
  const [billTargetVoucher, setBillTargetVoucher] =
    useState<AdditionalCost | null>(null);
  const [editingVoucher, setEditingVoucher] =
    useState<AdditionalCost | null>(null);
  const [editingQuickBooksBill, setEditingQuickBooksBill] = useState(false);
  const [quickBooksBillOnlyMode, setQuickBooksBillOnlyMode] = useState(false);
  const [supplierOptionsOpen, setSupplierOptionsOpen] = useState(false);
  const [categoryOptionsOpen, setCategoryOptionsOpen] = useState<{
    index: number;
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const openCategoryOptions = (index: number, target: HTMLInputElement) => {
    const rect = target.getBoundingClientRect();
    setCategoryOptionsOpen({
      index,
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(
        rect.width,
        Math.min(560, window.innerWidth - rect.left - 16),
      ),
    });
  };
  const [billOptions, setBillOptions] = useState<{
    vendors: Array<{ id: string; name: string }>;
    accounts: Array<{
      id: string;
      name: string;
      accountType?: string;
      accountSubType?: string;
    }>;
    terms: Array<{ id: string; name: string }>;
    taxCodes: Array<{ id: string; name: string; rate?: number }>;
  }>({ vendors: [], accounts: [], terms: [], taxCodes: [] });
  const [billOptionsLoading, setBillOptionsLoading] = useState(false);
  const [billOptionsError, setBillOptionsError] = useState<string | null>(null);
  const selectableBillTaxCodes = useMemo(
    () =>
      billOptions.taxCodes.filter(
        (taxCode) =>
          !hiddenBillGstCodeNames.has(taxCode.name.trim().toLowerCase()),
      ),
    [billOptions.taxCodes],
  );
  const [extractingBillDocument, setExtractingBillDocument] = useState(false);
  const [billDocumentPreview, setBillDocumentPreview] = useState<{
    name: string;
    type: string;
    url: string;
    confidence: Record<string, number>;
    supplierSuggestion?: { id: string; name: string };
    isPrefill: boolean;
  } | null>(null);
  const [savedDraftAttachments, setSavedDraftAttachments] = useState<
    StoredDraftAttachment[]
  >([]);
  const [pendingDraftClose, setPendingDraftClose] = useState(false);
  const [pendingExtractionFile, setPendingExtractionFile] =
    useState<File | null>(null);
  const [prefillFileSignature, setPrefillFileSignature] = useState<
    string | null
  >(null);
  const [supplierExtraction, setSupplierExtraction] = useState<{
    name: string;
    suggestion?: { id: string; name: string };
  } | null>(null);
  const [billDraft, setBillDraft] = useState({
    supplierId: "",
    supplierName: "",
    mailingAddress: "",
    termId: "",
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    billNumber: "",
    memo: "",
    overallGstAmount: "",
    attachments: [] as File[],
    lines: [
      {
        categoryId: "",
        categoryName: "",
        description: "",
        amount: "",
        taxCodeId: "",
      },
    ],
  });
  const [voucherDraft, setVoucherDraft] = useState({
    cost: "",
    reason: "",
    reasonOptionId: "",
    relatedSubitemIds: [] as string[],
    courier: "",
    remarks: "",
    orderNumber: "",
    modeOfPayment: "",
    modeOfPaymentOptionId: "",
  });
  const relatedSubitemsRef = useRef<HTMLDetailsElement>(null);
  const boardRelatedSubitemsMenuRef = useRef<HTMLDivElement>(null);
  const pickerScrollRef = useRef<HTMLDivElement>(null);
  const billExpenseTotal = useMemo(
    () =>
      billDraft.lines.reduce(
        (total, line) => total + (Number.parseFloat(line.amount) || 0),
        0,
      ),
    [billDraft.lines],
  );
  const billGrandTotal =
    billExpenseTotal + (Number.parseFloat(billDraft.overallGstAmount) || 0);
  const calculatedOverallGstAmount = useMemo(() => {
    const taxableAmountsByCode = new Map<string, number>();
    for (const line of billDraft.lines) {
      const amount = Number.parseFloat(line.amount);
      if (!line.taxCodeId || !Number.isFinite(amount)) continue;
      taxableAmountsByCode.set(
        line.taxCodeId,
        (taxableAmountsByCode.get(line.taxCodeId) ?? 0) + amount,
      );
    }
    return [...taxableAmountsByCode.entries()].reduce(
      (total, [taxCodeId, taxableAmount]) => {
        const rate = billOptions.taxCodes.find(
          (option) => option.id === taxCodeId,
        )?.rate;
        return total + Math.round(taxableAmount * (rate ?? 0)) / 100;
      },
      0,
    );
  }, [billDraft.lines, billOptions.taxCodes]);
  const otherReasonOptionId = useMemo(
    () =>
      labelOptions.additional_cost_reason?.find(
        (option) => option.systemKey === "additional_cost_reason_other",
      )?.id ?? "",
    [labelOptions.additional_cost_reason],
  );
  const voucherReasonIsOther =
    Boolean(otherReasonOptionId) &&
    voucherDraft.reasonOptionId === otherReasonOptionId;
  useEffect(() => {
    return () => {
      if (billDocumentPreview?.url)
        URL.revokeObjectURL(billDocumentPreview.url);
    };
  }, [billDocumentPreview?.url]);
  useEffect(() => {
    if (pickerOpen && (selectedVoucherClientId || quickBooksBillOnlyMode))
      return;
    setBillDocumentPreview(null);
    setPrefillFileSignature(null);
    setPendingExtractionFile(null);
    setSupplierExtraction(null);
  }, [pickerOpen, quickBooksBillOnlyMode, selectedVoucherClientId]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdditionalCost | null>(
    null,
  );
  const [deactivationReason, setDeactivationReason] = useState("");
  const [activityVoucher, setActivityVoucher] = useState<AdditionalCost | null>(null);
  const [activityRows, setActivityRows] = useState<
    Array<{
      id: string;
      actor_name: string;
      title: string;
      field_name?: string | null;
      old_value?: unknown;
      new_value?: unknown;
      meta?: { reason?: string };
      created_at: string;
    }>
  >([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const openActivity = async (row: AdditionalCost) => {
    setActivityVoucher(row);
    setActivityRows([]);
    setActivityLoading(true);
    const response = await fetch(`/api/additional-costs/activity?voucherId=${encodeURIComponent(row.id)}`);
    const result = await response.json();
    if (response.ok) setActivityRows(result.rows ?? []);
    else toast.error("Activity history could not be loaded", { description: result.error });
    setActivityLoading(false);
  };
  const logBillAction = (voucherId: string, action: string, title: string) =>
    fetch("/api/additional-costs/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voucherId, action, title }),
    }).catch(() => undefined);
  const [pendingQuickBooksBillClear, setPendingQuickBooksBillClear] =
    useState<AdditionalCost | null>(null);
  const [pendingBillErrorResolution, setPendingBillErrorResolution] =
    useState<AdditionalCost | null>(null);
  const [billLinkVoucher, setBillLinkVoucher] = useState<AdditionalCost | null>(
    null,
  );
  const [billLinkMode, setBillLinkMode] = useState<"choice" | "lookup">(
    "choice",
  );
  const [billLinkNumber, setBillLinkNumber] = useState("");
  const [billLinkResults, setBillLinkResults] = useState<
    Array<{
      id: string;
      billNumber: string;
      supplierName: string;
      billDate: string;
      dueDate: string;
      total: number;
      memo: string;
      alreadyLinked: boolean;
      linkedVoucherReference?: string | null;
    }>
  >([]);
  const [billLinkSearched, setBillLinkSearched] = useState(false);
  const [billLinkLoading, setBillLinkLoading] = useState(false);
  const rowRevisions = useRef(new Map<string, number>());
  const gridTemplateColumns = columns
    .map((column) => `${column.width}px`)
    .join(" ");
  const clientsById = useMemo(() => {
    const entries = new Map(clients.map((client) => [client.id, client]));
    for (const client of pickerClients) entries.set(client.id, client);
    return entries;
  }, [clients, pickerClients]);
  const projectForVoucher = useCallback(
    (row: AdditionalCost) => {
      const boardClient = clientsById.get(row.client_id);
      if (boardClient) {
        return { id: boardClient.id, label: clientLabel(boardClient), deleted: false };
      }
      if (row.linkedClient) {
        return {
          id: row.linkedClient.id,
          label: linkedClientLabel(row.linkedClient),
          deleted: Boolean(row.linkedClient.deletedAt),
        };
      }
      return null;
    },
    [clientsById],
  );
  const closeBillPreview = () => {
    setPickerOpen(false);
    setSelectedVoucherClientId(null);
    setOtherBillChoice(null);
    setBillTargetVoucher(null);
    setQuickBooksBillOnlyMode(false);
    setBillDocumentPreview(null);
    setPrefillFileSignature(null);
  };
  const pendingQuickBooksBillRow = ({
    id,
    clientId,
    voucherGroup,
    bill,
    voucher,
  }: {
    id: string;
    clientId: string;
    voucherGroup: AdditionalCost["voucher_group"];
    bill: typeof billDraft;
    voucher?: typeof voucherDraft;
  }): AdditionalCost => ({
    id,
    client_id: clientId,
    date_sent: null,
    people_id: null,
    people_ids: [],
    cost: bill.lines.reduce(
      (total, line) => total + (Number.parseFloat(line.amount) || 0),
      0,
    ),
    remarks: voucher?.remarks ?? bill.memo,
    status: "",
    reason: voucher?.reason ?? "",
    courier: "",
    trip_id: "Generating…",
    items_sent: voucher?.relatedSubitemIds.join(", ") ?? "",
    qty: "",
    verified: null,
    discussed: null,
    created_at: new Date().toISOString(),
    created_by: currentUserId ?? null,
    has_quickbooks_bill: false,
    quickbooks_invoice_number: bill.billNumber,
    quickbooks_supplier_id: bill.supplierId,
    quickbooks_supplier_name: bill.supplierName,
    quickbooks_memo: bill.memo,
    quickbooks_overall_gst_override:
      Number.parseFloat(bill.overallGstAmount) || 0,
    quickbooks_attachment_files: [],
    voucher_group: voucherGroup,
    isGeneratingQuickBooksBill: true,
  });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/additional-costs");
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not load Additional Costs.");
      setRows(result.rows ?? []);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load Additional Costs.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const supabase = createSupabaseClient();
    let disposed = false;
    let timer: number | undefined;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const scheduleReload = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        if (!disposed) void load();
      }, 300);
    };
    const start = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (disposed) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel("payment-voucher-live-refresh")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "additional_costs" },
          scheduleReload,
        )
        .subscribe();
    };
    void start();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);
  const loadLabelOptions = useCallback(async () => {
    const response = await fetch("/api/additional-costs/options");
    const result = await response.json();
    if (!response.ok) return;
    const groupIdToCode = new Map<string, string>(
      (result.groups ?? []).map((group: { id: string; code: string }) => [
        group.id,
        group.code,
      ]),
    );
    const next: Record<string, LabelOption[]> = {};
    for (const option of result.values ?? []) {
      const code = groupIdToCode.get(option.group_id);
      if (!code) continue;
      (next[code] ??= []).push({
        id: option.id,
        value: option.value,
        color: option.color,
        section: option.section_index ?? 0,
        systemKey: option.system_key ?? null,
      });
    }
    setLabelOptions(next);
  }, []);
  useEffect(() => {
    void loadLabelOptions();
  }, [loadLabelOptions]);
  const courierVoucherOptionIds = useMemo(
    () =>
      new Set(
        (labelOptions.additional_cost_courier ?? [])
          .map((option) => option.id)
          .filter((id): id is string => Boolean(id)),
      ),
    [labelOptions.additional_cost_courier],
  );
  const awardedOrLaterSubitemStatusIds = useMemo(
    () =>
      new Set(
        (labelOptions.subitem_status ?? [])
          .filter((option) =>
            AWARDED_OR_LATER_SUBITEM_STATUS_SYSTEM_KEYS.includes(
              option.systemKey as (typeof AWARDED_OR_LATER_SUBITEM_STATUS_SYSTEM_KEYS)[number],
            ),
          )
          .map((option) => option.id)
          .filter((id): id is string => Boolean(id)),
      ),
    [labelOptions.subitem_status],
  );
  // The group-two table can be edited without opening the creation dialog,
  // so its QuickBooks supplier selector needs its options up front.
  useEffect(() => {
    let active = true;
    void fetch("/api/quickbooks/vendors")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (active && response.ok)
          setBillOptions((current) => ({
            ...current,
            vendors: data.vendors ?? [],
          }));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!relatedSubitemsOpen) return;
    const closeOnClickAway = (event: MouseEvent) => {
      if (!relatedSubitemsRef.current?.contains(event.target as Node))
        setRelatedSubitemsOpen(false);
    };
    document.addEventListener("mousedown", closeOnClickAway);
    return () => document.removeEventListener("mousedown", closeOnClickAway);
  }, [relatedSubitemsOpen]);
  useEffect(() => {
    if (!pickerOpen) setRelatedSubitemsOpen(false);
  }, [pickerOpen]);
  useEffect(() => {
    if (!boardRelatedSubitemsMenu) return;
    const closeOnClickAway = (event: MouseEvent) => {
      const target = event.target as Element;
      if (
        !boardRelatedSubitemsMenuRef.current?.contains(target) &&
        !target.closest("[data-related-subitems-trigger]")
      )
        setBoardRelatedSubitemsMenu(null);
    };
    document.addEventListener("mousedown", closeOnClickAway);
    return () => document.removeEventListener("mousedown", closeOnClickAway);
  }, [boardRelatedSubitemsMenu]);
  useEffect(() => {
    if (
      !pickerOpen ||
      !["other", "quickbooks_bills_only"].includes(voucherCreationGroup) ||
      otherBillChoice !== "add"
    )
      return;
    let active = true;
    setBillOptionsLoading(true);
    setBillOptionsError(null);
    void Promise.all([
      fetch("/api/quickbooks/vendors").then((response) =>
        response.json().then((data) => ({ response, data })),
      ),
      fetch("/api/quickbooks/expense-accounts").then((response) =>
        response.json().then((data) => ({ response, data })),
      ),
      fetch("/api/quickbooks/terms").then((response) =>
        response.json().then((data) => ({ response, data })),
      ),
      fetch("/api/quickbooks/tax-codes").then((response) =>
        response.json().then((data) => ({ response, data })),
      ),
    ])
      .then(([vendors, accounts, terms, taxCodes]) => {
        if (!active) return;
        const failed = [vendors, accounts, terms, taxCodes].find(
          ({ response }) => !response.ok,
        );
        if (failed)
          throw new Error(
            failed.data?.error ?? "Could not load QuickBooks Bill options.",
          );
        setBillOptions({
          vendors: vendors.data.vendors ?? [],
          accounts: accounts.data.accounts ?? [],
          terms: terms.data.terms ?? [],
          taxCodes: taxCodes.data.taxCodes ?? [],
        });
      })
      .catch((loadError) => {
        if (active)
          setBillOptionsError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load QuickBooks Bill options.",
          );
      })
      .finally(() => {
        if (active) setBillOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [otherBillChoice, pickerOpen, voucherCreationGroup]);
  useEffect(() => {
    if (otherBillChoice !== "add") return;
    const total = billExpenseTotal > 0 ? billExpenseTotal.toFixed(2) : "";
    setVoucherDraft((draft) =>
      draft.cost === total ? draft : { ...draft, cost: total },
    );
  }, [billExpenseTotal, otherBillChoice]);
  useEffect(() => {
    if (otherBillChoice !== "add") return;
    const calculated = calculatedOverallGstAmount.toFixed(2);
    setBillDraft((draft) =>
      draft.overallGstAmount === calculated
        ? draft
        : { ...draft, overallGstAmount: calculated },
    );
  }, [calculatedOverallGstAmount, otherBillChoice]);
  const manageLabel = async (
    code: string,
    action: "add" | "color" | "rename",
    value: string,
    extra?: string,
    optionId?: string,
  ) => {
    const response = await fetch("/api/additional-costs/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "add"
          ? { code, action, value }
          : action === "color"
            ? { code, action, value, color: extra, optionId }
            : { code, action, value, nextValue: extra, optionId },
      ),
    });
    const result = await response.json();
    if (!response.ok) {
      toast.error("Label could not be updated", { description: result.error });
      return;
    }
    if (action === "rename" && optionId && extra) {
      const field =
        code === "additional_cost_status"
          ? "status"
          : code === "additional_cost_reason"
            ? "reason"
            : "courier";
      const idField = `${field}_option_id` as
        | "status_option_id"
        | "reason_option_id"
        | "courier_option_id";
      setRows((current) =>
        current.map((row) =>
          row[idField] === optionId ||
          (!row[idField] && row[field as keyof AdditionalCost] === value)
            ? {
                ...row,
                [field]: extra,
                [idField]: optionId,
              }
            : row,
        ),
      );
    }
    await loadLabelOptions();
  };
  const deleteLabel = async (
    code: string,
    value: string,
    optionId?: string,
  ) => {
    const response = await fetch("/api/options/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", code, optionId }),
    });
    const result = await response.json();
    if (!response.ok) {
      toast.error("Label could not be deleted", { description: result.error });
      return;
    }
    setRows((current) =>
      current.map((row) =>
        code === "additional_cost_status" && row.status_option_id === optionId
          ? { ...row, status: "", status_option_id: null }
          : code === "additional_cost_reason" &&
            row.reason_option_id === optionId
            ? { ...row, reason: "", reason_option_id: null }
            : code === "additional_cost_courier" &&
              row.courier_option_id === optionId
              ? { ...row, courier: "", courier_option_id: null }
              : row,
      ),
    );
    await loadLabelOptions();
  };
  const reorderLabels = async (code: string, layout: BadgeOptionLayout[]) => {
    const response = await fetch("/api/options/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, layout }),
    });
    const result = await response.json();
    if (!response.ok) {
      toast.error("Label order could not be saved", {
        description: result.error,
      });
      return;
    }
    await loadLabelOptions();
  };
  const resize = (
    group: VoucherGroupId,
    key: string,
    startX: number,
    startWidth: number,
  ) => {
    const onMove = (event: PointerEvent) =>
      setVoucherColumnLayouts((current) => ({
        ...current,
        [group]: {
          ...current[group],
          widths: {
            ...current[group].widths,
            [key]: Math.max(72, startWidth + event.clientX - startX),
          },
        },
      }));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setVoucherColumnLayouts((current) => {
        saveVoucherColumnLayout(current);
        return current;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  useEffect(() => {
    let active = true;
    void fetch("/api/payment-voucher-columns")
      .then((response) => response.json())
      .then((result) => {
        if (!active || !result.value) return;
        const normalise = (group: VoucherGroupId, base: Column[]) => {
          const candidate = result.value[group];
          // Migrate the previous one-layout format without linking the groups.
          const order = Array.isArray(candidate?.order)
            ? candidate.order
            : Array.isArray(result.value.order)
              ? result.value.order
              : [];
          const widths =
            candidate?.widths && typeof candidate.widths === "object"
              ? candidate.widths
              : (result.value.widths ?? {});
          return {
            order: [
              ...order.filter((key: string) =>
                base.some((column) => column.key === key),
              ),
              ...base
                .map((column) => column.key)
                .filter((key) => !order.includes(key)),
            ],
            widths: Object.fromEntries(
              base.map((column) => [
                column.key,
                Number.isFinite(widths[column.key])
                  ? Math.max(72, Number(widths[column.key]))
                  : column.width,
              ]),
            ),
          };
        };
        setVoucherColumnLayouts({
          courier: normalise("courier", initialColumns),
          other: normalise("other", otherVoucherColumns),
          quickbooks_bills_only: normalise(
            "quickbooks_bills_only",
            quickBooksBillsOnlyColumns,
          ),
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const saveVoucherColumnLayout = useCallback(
    (layouts: Record<VoucherGroupId, VoucherColumnLayout>) => {
      void fetch("/api/payment-voucher-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: layouts }),
      })
        .then((response) => {
          if (!response.ok) throw new Error();
        })
        .catch(() =>
          toast.error("Payment Voucher column layout could not be shared."),
        );
    },
    [],
  );
  const update = useCallback(
    async (id: string, values: Record<string, unknown>) => {
      const previous = rows.find((row) => row.id === id);
      if (!previous) return;
      if (previous.deactivated_at) {
        toast.error("A deactivated Payment Voucher cannot be updated.");
        return;
      }
      const revision = (rowRevisions.current.get(id) ?? 0) + 1;
      rowRevisions.current.set(id, revision);
      const rollback = Object.fromEntries(
        Object.keys(values).map((field) => [
          field,
          previous[field as keyof AdditionalCost],
        ]),
      );
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, ...values } : row)),
      );
      try {
        const response = await fetch("/api/additional-costs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, values }),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error ?? "Could not save the change.",
          ); /* Keep the newest optimistic row: an older PATCH response contains an older row snapshot. */
      } catch (updateError) {
        if (rowRevisions.current.get(id) === revision)
          setRows((current) =>
            current.map((row) =>
              row.id === id ? { ...row, ...rollback } : row,
            ),
          );
        toast.error("Additional cost could not be saved", {
          description:
            updateError instanceof Error
              ? updateError.message
              : "Please try again.",
        });
      }
    },
    [rows],
  );
  const create = async (clientId: string) => {
    setCreatingFor(clientId);
    try {
      const response = await fetch("/api/additional-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          paymentVoucherGroup: voucherCreationGroup,
          values: voucherDraft,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Could not create the additional cost.",
        );
      setRows((current) => [result.row, ...current]);
      setPickerOpen(false);
      setPickerQuery("");
      setSelectedVoucherClientId(null);
      setBillDocumentPreview(null);
      setPrefillFileSignature(null);
      setVoucherDraft({
        cost: "",
        reason: "",
        reasonOptionId: "",
        relatedSubitemIds: [],
        courier: "",
        remarks: "",
        orderNumber: "",
        modeOfPayment: "",
        modeOfPaymentOptionId: "",
      });
      toast.success("Payment voucher added");
    } catch (createError) {
      toast.error("Additional cost could not be created", {
        description:
          createError instanceof Error
            ? createError.message
            : "Please try again.",
      });
    } finally {
      setCreatingFor(null);
    }
  };
  const openVoucherEditor = async (row: AdditionalCost) => {
    setCreatingFor(row.id);
    try {
      // Payment Voucher rows deliberately contain only a lightweight linked
      // client display payload. Load the current client bundle here before the
      // preview opens so its Related Subitems selector is complete even when
      // the client is not on the currently hydrated CRM Board page.
      const hydration = await fetchHydratedClientBundle([row.client_id]);
      const client = hydration.clients[0];
      if (!client) throw new Error("The linked client is no longer available.");
      setPickerClients((current) => {
        const next = new Map(current.map((candidate) => [candidate.id, candidate]));
        next.set(client.id, client);
        return Array.from(next.values());
      });
      const eligibleSubitems = client.subitems.filter(
        (subitem) =>
          !subitem.customFields?.additionalCostId &&
          awardedOrLaterSubitemStatusIds.has(subitem.statusOptionId ?? ""),
      );
      // IDs are unambiguous. Older vouchers only retained a comma-separated
      // display name, so keep that as a one-time compatibility fallback while
      // excluding ineligible and payment-voucher subitems.
      const storedRelatedIds = Array.isArray(row.related_subitem_ids)
        ? row.related_subitem_ids.filter((id): id is string => typeof id === "string")
        : [];
      const selectedNames = new Set(
        row.items_sent.split(",").map((name) => name.trim()).filter(Boolean),
      );
      setEditingVoucher(row);
      setVoucherCreationGroup(row.voucher_group === "other" ? "other" : "courier");
      setOtherBillChoice(row.is_draft ? "add" : null);
      setSelectedVoucherClientId(row.client_id);
      setVoucherDraft({
        cost: row.cost == null ? "" : String(row.cost),
        reason: row.reason,
        reasonOptionId: row.reason_option_id ?? "",
        relatedSubitemIds: storedRelatedIds.length
          ? eligibleSubitems
              .filter((subitem) => storedRelatedIds.includes(subitem.id))
              .map((subitem) => subitem.id)
          : eligibleSubitems
              .filter((subitem) => selectedNames.has(subitem.name))
              .map((subitem) => subitem.id),
        courier: row.courier,
        remarks: row.remarks,
        orderNumber: row.order_number ?? "",
        modeOfPayment: row.mode_of_payment ?? "",
        modeOfPaymentOptionId: row.mode_of_payment_option_id ?? "",
      });
      if (row.is_draft) {
        const draftBill = row.draft_bill ?? {};
        const today = new Date().toISOString().slice(0, 10);
        setBillDraft({
          supplierId: draftBill.supplierId ?? "",
          supplierName: draftBill.supplierName ?? "",
          mailingAddress: draftBill.mailingAddress ?? "",
          termId: draftBill.termId ?? "",
          billDate: draftBill.billDate ?? today,
          dueDate: draftBill.dueDate ?? today,
          billNumber: draftBill.billNumber ?? "",
          memo: draftBill.memo ?? "",
          overallGstAmount: draftBill.overallGstAmount ?? "",
          attachments: [],
          lines: draftBill.lines?.length
            ? draftBill.lines.map((line) => ({
                categoryId: line.categoryId ?? "",
                categoryName: line.categoryName ?? "",
                description: line.description ?? "",
                amount: line.amount ?? "",
                taxCodeId: line.taxCodeId ?? "",
              }))
            : [{ categoryId: "", categoryName: "", description: "", amount: "", taxCodeId: "" }],
        });
        const attachments = draftBill.attachmentFiles ?? [];
        setSavedDraftAttachments(attachments);
        const prefillFile = attachments.find(
          (file) => file.name === row.draft_ocr?.prefillFileName,
        );
        if (prefillFile?.url) {
          setBillDocumentPreview({
            name: prefillFile.name,
            type: prefillFile.mimeType ?? "application/octet-stream",
            url: prefillFile.url,
            confidence: row.draft_ocr?.confidence ?? {},
            isPrefill: true,
          });
          setPrefillFileSignature(prefillFile.name);
        }
        const extraction = row.draft_ocr?.supplierExtraction;
        setSupplierExtraction(
          extraction?.name
            ? { name: extraction.name, suggestion: extraction.suggestion }
            : null,
        );
      } else {
        setSavedDraftAttachments([]);
      }
      setPickerOpen(true);
    } catch (error) {
      toast.error("Payment voucher could not be opened", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setCreatingFor(null);
    }
  };
  const saveVoucherEdit = async () => {
    if (!editingVoucher) return;
    setCreatingFor(editingVoucher.id);
    try {
      const response = await fetch("/api/additional-costs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingVoucher.id,
          values: {
            cost: voucherDraft.cost,
            reason: voucherDraft.reason,
            ...(voucherDraft.relatedSubitemIds.length
              ? { relatedSubitemIds: voucherDraft.relatedSubitemIds }
              : {}),
            courier: voucherDraft.courier,
            remarks: voucherDraft.remarks,
            order_number: voucherDraft.orderNumber,
            mode_of_payment: voucherDraft.modeOfPaymentOptionId,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save the payment voucher.");
      setRows((current) => current.map((row) => row.id === editingVoucher.id ? result.row : row));
      setPickerOpen(false);
      setEditingVoucher(null);
      toast.success("Payment voucher updated");
    } catch (error) {
      toast.error("Payment voucher could not be saved", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setCreatingFor(null);
    }
  };
  const savePaymentVoucherDraft = async (closeAfterSave = true) => {
    if (!selectedVoucherClientId) return;
    setCreatingFor(editingVoucher?.id ?? selectedVoucherClientId);
    try {
      const uploadedAttachments = billDraft.attachments.length
        ? await uploadCrmFiles(
            billDraft.attachments,
            `payment-vouchers/drafts/${editingVoucher?.id ?? "new"}`,
            { clientId: selectedVoucherClientId },
          )
        : [];
      const attachmentFiles = [
        ...savedDraftAttachments,
        ...uploadedAttachments,
      ].filter(
        (file, index, all) =>
          all.findIndex((candidate) => candidate.storagePath === file.storagePath) ===
          index,
      );
      const confidence = billDocumentPreview?.confidence ?? {};
      const response = await fetch("/api/additional-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-draft",
          ...(editingVoucher?.is_draft ? { id: editingVoucher.id } : {}),
          clientId: selectedVoucherClientId,
          values: voucherDraft,
          bill: {
            ...billDraft,
            attachments: undefined,
            attachmentFiles,
          },
          ocr: {
            confidence,
            prefillFileName: billDocumentPreview?.isPrefill
              ? billDocumentPreview.name
              : "",
            supplierExtraction,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not save the Payment Voucher draft.");
      setRows((current) => {
        const index = current.findIndex((row) => row.id === result.row.id);
        return index < 0
          ? [result.row, ...current]
          : current.map((row) => (row.id === result.row.id ? result.row : row));
      });
      setEditingVoucher(result.row);
      setSavedDraftAttachments(attachmentFiles);
      setBillDraft((draft) => ({ ...draft, attachments: [] }));
      toast.success("Payment Voucher draft saved", {
        description: `${result.row.trip_id} can be continued from Group 2.`,
      });
      if (closeAfterSave) {
        closePaymentVoucherPreview();
      }
      return result.row as AdditionalCost;
    } catch (error) {
      toast.error("Payment Voucher draft could not be saved", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
      return null;
    } finally {
      setCreatingFor(null);
    }
  };
  const closePaymentVoucherPreview = () => {
    setPickerOpen(false);
    setPendingDraftClose(false);
    setBillTargetVoucher(null);
    setEditingVoucher(null);
    setEditingQuickBooksBill(false);
    setQuickBooksBillOnlyMode(false);
    setBillDocumentPreview(null);
    setPrefillFileSignature(null);
    setSavedDraftAttachments([]);
  };
  const requestClosePaymentVoucherPreview = () => {
    const canSaveDraft =
      voucherCreationGroup === "other" &&
      Boolean(selectedVoucherClientId) &&
      !quickBooksBillOnlyMode &&
      (!editingVoucher || Boolean(editingVoucher.is_draft));
    if (canSaveDraft) {
      setPendingDraftClose(true);
      return;
    }
    closePaymentVoucherPreview();
  };
  useEffect(() => {
    if (!pickerOpen || pendingDraftClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const canSaveDraft =
        voucherCreationGroup === "other" &&
        Boolean(selectedVoucherClientId) &&
        !quickBooksBillOnlyMode &&
        (!editingVoucher || Boolean(editingVoucher.is_draft));
      if (canSaveDraft) {
        setPendingDraftClose(true);
        return;
      }
      setPickerOpen(false);
      setBillTargetVoucher(null);
      setEditingVoucher(null);
      setEditingQuickBooksBill(false);
      setQuickBooksBillOnlyMode(false);
      setBillDocumentPreview(null);
      setPrefillFileSignature(null);
      setSavedDraftAttachments([]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    pickerOpen,
    pendingDraftClose,
    voucherCreationGroup,
    selectedVoucherClientId,
    quickBooksBillOnlyMode,
    editingVoucher,
  ]);
  const validateBillGeneration = (needsNewVoucher: boolean) => {
    if (!billDraft.supplierName.trim()) return "Supplier is required.";
    if (!billDraft.billNumber.trim()) return "Invoice no. is required.";
    if (!billDraft.memo.trim()) return "Memo is required.";
    if (!billDraft.lines.length) return "Add at least one expense line.";
    const invalidLine = billDraft.lines.findIndex(
      (line) =>
        !line.categoryId ||
        !line.taxCodeId ||
        !Number.isFinite(Number(line.amount)) ||
        Number(line.amount) <= 0,
    );
    if (invalidLine >= 0)
      return `Complete Category, Amount and GST for expense line ${invalidLine + 1}.`;
    const gst = Number(billDraft.overallGstAmount);
    if (
      billDraft.overallGstAmount.trim() !== "" &&
      (!Number.isFinite(gst) || gst < 0)
    )
      return "Overall GST amount must be zero or greater.";
    if (!needsNewVoucher) return null;
    const voucherCost = Number(voucherDraft.cost);
    if (!Number.isFinite(voucherCost) || voucherCost <= 0)
      return "Payment Voucher Cost must be greater than zero.";
    if (Math.abs(voucherCost - billExpenseTotal) > 0.005)
      return "Payment Voucher Cost must equal the expense-line total.";
    if (!voucherDraft.reason) return "Payment Voucher Reason is required.";
    if (!voucherDraft.relatedSubitemIds.length)
      return "Select at least one Related Subitem.";
    if (voucherReasonIsOther && !voucherDraft.remarks.trim())
      return "Remarks is required when Reason is Other.";
    return null;
  };
  const generateQuickBooksBill = async (
    clientId: string,
    existingVoucher?: AdditionalCost | null,
  ) => {
    const validationError = validateBillGeneration(
      !existingVoucher || Boolean(existingVoucher.is_draft),
    );
    if (validationError) {
      toast.error("Bill cannot be generated", { description: validationError });
      return;
    }
    let restoredAttachments: File[];
    try {
      restoredAttachments = await Promise.all(
        savedDraftAttachments.map(async (file) => {
          const response = await fetch(file.url);
          if (!response.ok)
            throw new Error(`Could not retrieve saved attachment ${file.name}.`);
          const blob = await response.blob();
          return new File([blob], file.name, {
            type: file.mimeType || blob.type || "application/octet-stream",
          });
        }),
      );
    } catch (error) {
      toast.error("Saved attachment could not be loaded", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
      return;
    }
    const draft = {
      ...billDraft,
      attachments: [...restoredAttachments, ...billDraft.attachments],
    };
    const pendingId = `pending-quickbooks-bill-${crypto.randomUUID()}`;
    const pendingRow = pendingQuickBooksBillRow({
      id: pendingId,
      clientId,
      voucherGroup: existingVoucher?.voucher_group ?? "other",
      bill: draft,
      voucher: existingVoucher?.is_draft ? voucherDraft : existingVoucher ? undefined : voucherDraft,
    });
    setCreatingFor(clientId);
    setRows((current) =>
      existingVoucher
        ? current.map((row) =>
          row.id === existingVoucher.id
            ? { ...row, isGeneratingQuickBooksBill: true }
            : row,
        )
        : [pendingRow, ...current],
    );
    closeBillPreview();
    const generatingToast = toast.loading("Generating QuickBooks bill");
    try {
      const { attachments, ...billDraftValues } = draft;
      const bill = {
        ...billDraftValues,
        attachmentFiles: attachments.length
          ? await uploadCrmFiles(
            attachments,
            `payment-vouchers/${existingVoucher?.id ?? "new"}/quickbooks-bills`,
            { clientId },
          )
          : [],
      };
      const payload = new FormData();
      payload.append(
        "payload",
        JSON.stringify(
          existingVoucher
            ? {
                clientId,
                voucherId: existingVoucher.id,
                ...(existingVoucher.is_draft ? { voucher: voucherDraft } : {}),
                bill,
              }
            : { clientId, voucher: voucherDraft, bill },
        ),
      );
      attachments.forEach((attachment) =>
        payload.append("attachments", attachment, attachment.name),
      );
      const response = await fetch("/api/quickbooks/generate-bill", {
        method: "POST",
        body: payload,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Could not generate the QuickBooks Bill.",
        );
      setRows((current) =>
        existingVoucher
          ? current.map((row) =>
            row.id === existingVoucher.id ? result.row : row,
          )
          : current.map((row) => (row.id === pendingId ? result.row : row)),
      );
      toast.dismiss(generatingToast);
      toast.success(
        existingVoucher
          ? `QuickBooks Bill ${result.docNumber ?? ""} added to this payment voucher.`
          : `QuickBooks Bill ${result.docNumber ?? ""} and payment voucher created.`,
      );
      if (result.row?.id)
        void logBillAction(
          result.row.id,
          existingVoucher ? "bill_created" : "bill_created_with_voucher",
          existingVoucher ? "created a QuickBooks Bill" : "created a Payment Voucher and QuickBooks Bill",
        );
      if (result.attachmentErrors?.length)
        toast.warning(
          "The Bill was created, but some attachments could not be uploaded.",
          {
            description: result.attachmentErrors
              .map((error: string) => error.split(":")[0])
              .join(", "),
          },
        );
    } catch (generationError) {
      setRows((current) =>
        existingVoucher
          ? current.map((row) =>
            row.id === existingVoucher.id
              ? { ...row, isGeneratingQuickBooksBill: false }
              : row,
          )
          : current.filter((row) => row.id !== pendingId),
      );
      toast.dismiss(generatingToast);
      toast.error("QuickBooks Bill could not be generated", {
        description:
          generationError instanceof Error
            ? generationError.message
            : "Please try again.",
      });
    } finally {
      setCreatingFor(null);
    }
  };
  const generateQuickBooksBillOnly = async (
    existingVoucher?: AdditionalCost | null,
  ) => {
    const validationError = validateBillGeneration(false);
    if (validationError) {
      toast.error("Bill cannot be generated", { description: validationError });
      return;
    }
    const draft = billDraft;
    const pendingId = `pending-quickbooks-bill-${crypto.randomUUID()}`;
    const pendingRow = pendingQuickBooksBillRow({
      id: pendingId,
      clientId: existingVoucher?.client_id ?? "",
      voucherGroup: "quickbooks_bills_only",
      bill: draft,
    });
    setCreatingFor(existingVoucher?.id ?? "quickbooks-bills-only");
    setRows((current) =>
      existingVoucher
        ? current.map((row) =>
          row.id === existingVoucher.id
            ? { ...row, isGeneratingQuickBooksBill: true }
            : row,
        )
        : [pendingRow, ...current],
    );
    closeBillPreview();
    const generatingToast = toast.loading("Generating QuickBooks bill");
    try {
      const { attachments, ...billDraftValues } = draft;
      const bill = {
        ...billDraftValues,
        attachmentFiles: attachments.length
          ? await uploadCrmFiles(
            attachments,
            existingVoucher?.voucher_group === "quickbooks_bills_only" ||
              !existingVoucher
              ? "quickbooks-bills-only"
              : `payment-vouchers/${existingVoucher.id}/quickbooks-bills`,
            {
              clientId:
                existingVoucher?.voucher_group === "quickbooks_bills_only" ||
                  !existingVoucher
                  ? "quickbooks-bills-only"
                  : existingVoucher.client_id,
            },
          )
          : [],
      };
      const payload = new FormData();
      payload.append(
        "payload",
        JSON.stringify({
          ...(existingVoucher ? { voucherId: existingVoucher.id } : {}),
          bill,
        }),
      );
      attachments.forEach((attachment) =>
        payload.append("attachments", attachment, attachment.name),
      );
      const response = await fetch("/api/quickbooks/generate-bill-only", {
        method: "POST",
        body: payload,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Could not generate the QuickBooks Bill.",
        );
      setRows((current) =>
        existingVoucher
          ? current.map((row) =>
            row.id === existingVoucher.id ? result.row : row,
          )
          : current.map((row) => (row.id === pendingId ? result.row : row)),
      );
      toast.dismiss(generatingToast);
      toast.success(
        existingVoucher
          ? `QuickBooks Bill ${result.docNumber ?? ""} recreated.`
          : `QuickBooks Bill ${result.docNumber ?? ""} created.`,
      );
      if (result.row?.id)
        void logBillAction(
          result.row.id,
          "bill_created",
          existingVoucher ? "recreated a QuickBooks Bill" : "created a QuickBooks Bill",
        );
      if (result.attachmentErrors?.length) {
        toast.warning(
          "The Bill was created, but some attachments could not be uploaded.",
          {
            description: result.attachmentErrors
              .map((entry: string) => entry.split(":")[0])
              .join(", "),
          },
        );
      }
    } catch (generationError) {
      setRows((current) =>
        existingVoucher
          ? current.map((row) =>
            row.id === existingVoucher.id
              ? { ...row, isGeneratingQuickBooksBill: false }
              : row,
          )
          : current.filter((row) => row.id !== pendingId),
      );
      toast.dismiss(generatingToast);
      toast.error("QuickBooks Bill could not be generated", {
        description:
          generationError instanceof Error
            ? generationError.message
            : "Please try again.",
      });
    } finally {
      setCreatingFor(null);
    }
  };
  const openAddBill = (row: AdditionalCost, prefillFromBrokenLink = false) => {
    const client = clientsById.get(row.client_id);
    const billOnly = row.voucher_group === "quickbooks_bills_only";
    setVoucherCreationGroup(billOnly ? "quickbooks_bills_only" : "other");
    setQuickBooksBillOnlyMode(billOnly);
    setSelectedVoucherClientId(billOnly ? null : row.client_id);
    setBillTargetVoucher(row);
    setEditingQuickBooksBill(false);
    setOtherBillChoice("add");
    setBillDocumentPreview(null);
    setPrefillFileSignature(null);
    setPendingExtractionFile(null);
    setBillDraft({
      supplierId: prefillFromBrokenLink
        ? (row.quickbooks_supplier_id ?? "")
        : "",
      supplierName: prefillFromBrokenLink
        ? (row.quickbooks_supplier_name ?? "")
        : "",
      mailingAddress: "",
      termId: "",
      billDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      billNumber: prefillFromBrokenLink
        ? (row.quickbooks_invoice_number ?? "")
        : "",
      memo: client ? clientLabel(client) : "",
      overallGstAmount:
        row.quickbooks_overall_gst_override == null
          ? ""
          : String(row.quickbooks_overall_gst_override),
      attachments: [],
      lines: [
        {
          categoryId: "",
          categoryName: "",
          description: "",
          amount:
            prefillFromBrokenLink && row.cost != null ? String(row.cost) : "",
          taxCodeId: "",
        },
      ],
    });
    setPickerOpen(true);
  };
  const lookupExistingBill = async () => {
    if (!billLinkVoucher || !billLinkNumber.trim()) return;
    setBillLinkLoading(true);
    try {
      const response = await fetch("/api/quickbooks/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lookup",
          voucherId: billLinkVoucher.id,
          billNumber: billLinkNumber,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not find QuickBooks Bills.");
      setBillLinkResults(result.bills ?? []);
      setBillLinkSearched(true);
    } catch (error) {
      toast.error("QuickBooks Bill lookup failed", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBillLinkLoading(false);
    }
  };
  const linkExistingBill = async (billId: string) => {
    if (!billLinkVoucher) return;
    setBillLinkLoading(true);
    try {
      const response = await fetch("/api/quickbooks/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link",
          voucherId: billLinkVoucher.id,
          billId,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not link QuickBooks Bill.");
      setRows((current) =>
        current.map((row) =>
          row.id === billLinkVoucher.id ? result.row : row,
        ),
      );
      setBillLinkVoucher(null);
      setBillLinkResults([]);
      setBillLinkNumber("");
      toast.success("QuickBooks Bill linked to payment voucher.");
      void logBillAction(billLinkVoucher.id, "bill_linked", "linked a QuickBooks Bill");
    } catch (error) {
      toast.error("QuickBooks Bill could not be linked", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBillLinkLoading(false);
    }
  };
  const removeBrokenBillLink = async (voucher: AdditionalCost) => {
    try {
      const response = await fetch("/api/quickbooks/bill", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voucherId: voucher.id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not remove the Bill link.");
      setRows((current) =>
        current.map((row) => (row.id === voucher.id ? result.row : row)),
      );
      setPendingBillErrorResolution(null);
      toast.success(
        "QuickBooks Bill information removed from this payment voucher.",
      );
      void logBillAction(voucher.id, "bill_unlinked", "removed the QuickBooks Bill link");
    } catch (removeError) {
      toast.error("Bill link could not be removed", {
        description:
          removeError instanceof Error
            ? removeError.message
            : "Please try again.",
      });
    }
  };
  const openEditBill = async (row: AdditionalCost) => {
    setCreatingFor(row.id);
    try {
      const response = await fetch(
        `/api/quickbooks/bill?voucherId=${encodeURIComponent(row.id)}`,
      );
      const result = await response.json();
      if (!response.ok) {
        if (result.billSyncError) {
          setRows((current) =>
            current.map((currentRow) =>
              currentRow.id === row.id
                ? {
                  ...currentRow,
                  quickbooks_bill_sync_error: result.billSyncError,
                }
                : currentRow,
            ),
          );
        }
        throw new Error(result.error ?? "Could not load the QuickBooks Bill.");
      }
      const bill = result.bill;
      if (result.voucher) {
        setRows((current) =>
          current.map((currentRow) =>
            currentRow.id === row.id ? result.voucher : currentRow,
          ),
        );
      }
      void logBillAction(row.id, "bill_loaded", "loaded the latest QuickBooks Bill information");
      setVoucherCreationGroup(
        row.voucher_group === "quickbooks_bills_only"
          ? "quickbooks_bills_only"
          : "other",
      );
      setQuickBooksBillOnlyMode(row.voucher_group === "quickbooks_bills_only");
      setSelectedVoucherClientId(row.client_id);
      setBillTargetVoucher(row);
      setEditingQuickBooksBill(true);
      setOtherBillChoice("add");
      setBillDocumentPreview(null);
      setPrefillFileSignature(null);
      setPendingExtractionFile(null);
      setBillDraft({ ...bill, attachments: [] });
      setPickerOpen(true);
    } catch (loadError) {
      toast.error("QuickBooks Bill could not be loaded", {
        description:
          loadError instanceof Error ? loadError.message : "Please try again.",
      });
    } finally {
      setCreatingFor(null);
    }
  };
  const updateQuickBooksBill = async (voucher: AdditionalCost) => {
    setCreatingFor(voucher.id);
    try {
      const { attachments, ...billDraftValues } = billDraft;
      const payload = new FormData();
      const attachmentFiles = attachments.length
        ? await uploadCrmFiles(
          attachments,
          voucher.voucher_group === "quickbooks_bills_only"
            ? "quickbooks-bills-only"
            : `payment-vouchers/${voucher.id}/quickbooks-bills`,
          {
            clientId:
              voucher.voucher_group === "quickbooks_bills_only"
                ? "quickbooks-bills-only"
                : voucher.client_id,
          },
        )
        : [];
      payload.append(
        "payload",
        JSON.stringify({
          voucherId: voucher.id,
          bill: { ...billDraftValues, attachmentFiles },
        }),
      );
      attachments.forEach((attachment) =>
        payload.append("attachments", attachment, attachment.name),
      );
      const response = await fetch("/api/quickbooks/bill", {
        method: "PATCH",
        body: payload,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Could not update the QuickBooks Bill.",
        );
      setRows((current) =>
        current.map((row) => (row.id === voucher.id ? result.row : row)),
      );
      setPickerOpen(false);
      setSelectedVoucherClientId(null);
      setBillTargetVoucher(null);
      setEditingQuickBooksBill(false);
      setQuickBooksBillOnlyMode(false);
      setOtherBillChoice(null);
      setBillDocumentPreview(null);
      setPrefillFileSignature(null);
      toast.success("QuickBooks Bill and Payment Voucher cost updated.");
      void logBillAction(voucher.id, "bill_updated", "updated the QuickBooks Bill");
    } catch (updateError) {
      toast.error("QuickBooks Bill could not be updated", {
        description:
          updateError instanceof Error
            ? updateError.message
            : "Please try again.",
      });
    } finally {
      setCreatingFor(null);
    }
  };
  const extractBillDocument = async (file: File) => {
    if (!selectedVoucherClientId && !quickBooksBillOnlyMode) return;
    const previewUrl = URL.createObjectURL(file);
    setPrefillFileSignature(`${file.name}-${file.lastModified}`);
    setSupplierExtraction(null);
    setBillDocumentPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return {
        name: file.name,
        type: file.type,
        url: previewUrl,
        confidence: {},
        isPrefill: true,
      };
    });
    setBillDraft((draft) =>
      draft.attachments.some(
        (attachment) =>
          attachment.name === file.name &&
          attachment.lastModified === file.lastModified,
      )
        ? draft
        : { ...draft, attachments: [...draft.attachments, file] },
    );
    setExtractingBillDocument(true);
    try {
      const payload = new FormData();
      payload.append("file", file, file.name);
      if (selectedVoucherClientId)
        payload.append("clientId", selectedVoucherClientId);
      const response = await fetch("/api/quickbooks/extract-bill-document", {
        method: "POST",
        body: payload,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not extract this document.");
      const extraction = result.extraction as {
        supplierName?: string;
        mailingAddress?: string;
        invoiceNumber?: string;
        billDate?: string;
        dueDate?: string;
        confidence?: Record<string, number>;
        lines?: Array<{
          description?: string;
          amount?: number | null;
          tax?: string;
        }>;
      };
      const normalise = (value: string) => value.trim().toLocaleLowerCase();
      const extractedSupplier = supplierSearchKey(
        extraction.supplierName ?? "",
      );
      const suppliersByCloseness = billOptions.vendors
        .map((option) => ({
          ...option,
          score: extractedSupplier
            ? levenshteinDistance(
              supplierSearchKey(option.name),
              extractedSupplier,
            ) /
            Math.max(
              supplierSearchKey(option.name).length,
              extractedSupplier.length,
              1,
            )
            : Number.POSITIVE_INFINITY,
        }))
        .sort((first, second) => first.score - second.score);
      const supplier = suppliersByCloseness[0];
      const exactSupplier = supplier?.score === 0 ? supplier : undefined;
      const findTaxCode = (tax: string) => {
        const query = normalise(tax);
        if (!query) return "";
        return (
          billOptions.taxCodes.find(
            (option) =>
              normalise(option.name).includes(query) ||
              query.includes(normalise(option.name)),
          )?.id ?? ""
        );
      };
      setBillDraft((draft) => ({
        ...draft,
        supplierId: exactSupplier?.id ?? "",
        supplierName: extraction.supplierName || draft.supplierName,
        mailingAddress: extraction.mailingAddress || draft.mailingAddress,
        billDate: extraction.billDate || draft.billDate,
        dueDate: extraction.dueDate || draft.dueDate,
        billNumber: extraction.invoiceNumber || draft.billNumber,
        lines: extraction.lines?.length
          ? extraction.lines.map((line) => ({
            categoryId: "",
            categoryName: "",
            description: line.description ?? "",
            amount: line.amount ? String(line.amount) : "",
            taxCodeId: findTaxCode(line.tax ?? ""),
          }))
          : draft.lines,
      }));
      setBillDocumentPreview((current) =>
        current
          ? {
            ...current,
            confidence: extraction.confidence ?? {},
            supplierSuggestion:
              supplier && extractedSupplier
                ? { id: supplier.id, name: supplier.name }
                : undefined,
          }
          : current,
      );
      setSupplierExtraction({
        name: String(extraction.supplierName ?? "").trim(),
        suggestion:
          supplier && extractedSupplier
            ? { id: supplier.id, name: supplier.name }
            : undefined,
      });
      toast.success(
        "Document fields were prefilled. Please review every value before creating the Bill.",
      );
    } catch (extractionError) {
      console.warn("Could not prefill QuickBooks Bill fields from the document", extractionError);
      setPrefillFileSignature(null);
      setSupplierExtraction(null);
      setBillDocumentPreview((current) =>
        current ? { ...current, isPrefill: false } : current,
      );
      toast.warning("OCR could not read this document", {
        description:
          "The file has still been attached and remains open for manual reference. Please enter the Bill details manually.",
      });
    } finally {
      setExtractingBillDocument(false);
    }
  };
  const previewAttachment = (file: File) => {
    const url = URL.createObjectURL(file);
    setBillDocumentPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      const isPrefill =
        prefillFileSignature === `${file.name}-${file.lastModified}`;
      return {
        name: file.name,
        type: file.type,
        url,
        confidence: {},
        isPrefill,
      };
    });
  };
  const canDelete = (row: AdditionalCost) => {
    if (typeof row.can_edit === "boolean") return row.can_edit;
    if (row.deactivated_at) return false;
    const role = String(currentUserRole ?? "").toLowerCase();
    if (row.voucher_group === "quickbooks_bills_only") {
      return ["admin", "director", "dev"].includes(role);
    }
    return (
      ["admin", "director"].includes(role) ||
      (!!currentUserId &&
        ((clientAssignees[row.client_id] ?? []).includes(currentUserId) ||
          (clientPmAssignees[row.client_id] ?? []).includes(currentUserId)))
    );
  };
  const canDeactivate = (row: AdditionalCost) => {
    if (typeof row.can_deactivate === "boolean") return row.can_deactivate;
    if (row.deactivated_at) return false;
    const role = String(currentUserRole ?? "").toLowerCase();
    if (["admin", "director", "dev"].includes(role)) return true;
    return (
      !!currentUserId &&
      ((clientAssignees[row.client_id] ?? []).includes(currentUserId) ||
        (clientPmAssignees[row.client_id] ?? []).includes(currentUserId))
    );
  };
  const creationRestriction = (client: Client) => {
    if (client.customFields?.subitemsLocked === "true") {
      return "This client is locked. Unlock its subitems on the CRM Board before adding an additional cost.";
    }
    const role = String(currentUserRole ?? "").toLowerCase();
    const isAssigned =
      !!currentUserId &&
      ((pickerClientAssignees[client.id] ??
        clientAssignees[client.id] ??
        []).includes(currentUserId) ||
        (pickerClientPmAssignees[client.id] ??
          clientPmAssignees[client.id] ??
          []).includes(currentUserId));
    if (!["admin", "director"].includes(role) && !isAssigned) {
      return "You can only link an additional cost to a client assigned to you as People or PM.";
    }
    return null;
  };
  const remove = async (row: AdditionalCost) => {
    setDeletingId(row.id);
    try {
      const response = await fetch(
        `/api/additional-costs?id=${encodeURIComponent(row.id)}&reason=${encodeURIComponent(deactivationReason.trim())}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Could not delete the additional cost.",
        );
      setRows((current) => current.map((candidate) => candidate.id === row.id
        ? { ...candidate, deactivated_at: new Date().toISOString(), deactivation_reason: deactivationReason.trim() }
        : candidate));
      setPendingDelete(null);
      setDeactivationReason("");
      toast.success("Payment Voucher deactivated");
    } catch (deleteError) {
      toast.error("Additional cost could not be deleted", {
        description:
          deleteError instanceof Error
            ? deleteError.message
            : "Please try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };
  const clientSections = useMemo(() => {
    const sections = [...groups]
      .sort((first, second) => first.sort_order - second.sort_order)
      .map((group) => ({
        id: group.id,
        label: group.name,
        clients: pickerClients
          .filter((client) => client.groupId === group.id)
          .sort(compareByDefaultClientBoardOrder),
      }))
      .filter((section) => section.clients.length);
    const ungrouped = pickerClients
      .filter(
        (client) =>
          !client.groupId ||
          !groups.some((group) => group.id === client.groupId),
      )
      .sort(compareByDefaultClientBoardOrder);
    if (ungrouped.length)
      sections.push({
        id: "ungrouped",
        label: "Ungrouped",
        clients: ungrouped,
      });
    return sections;
  }, [pickerClients, groups]);
  const loadPickerClientPage = useCallback(
    async (offset: number, append: boolean, query: string) => {
      const request = append
        ? pickerClientRequest.current
        : ++pickerClientRequest.current;
      if (append) setPickerClientsLoadingMore(true);
      else {
        setPickerClientsLoading(true);
        setPickerClients([]);
        setPickerClientTotal(0);
        setPickerClientOffset(0);
      }
      try {
        const page = await fetchHydratedClientGroupPage(
          null,
          offset,
          PAYMENT_VOUCHER_CLIENT_PAGE_SIZE,
          {
            search: query.trim() || undefined,
            sortCategory: "client",
            sortColumn: "dateCreated",
            sortValueType: "date",
            sortDirection: "desc",
          },
        );
        if (request !== pickerClientRequest.current) return;
        setPickerClients((current) => {
          if (!append) return page.clients;
          const next = new Map(current.map((client) => [client.id, client]));
          for (const client of page.clients) next.set(client.id, client);
          return Array.from(next.values());
        });
        setPickerClientAssignees((current) =>
          append
            ? { ...current, ...page.clientAssignees }
            : page.clientAssignees,
        );
        setPickerClientPmAssignees((current) =>
          append
            ? { ...current, ...page.clientPmAssignees }
            : page.clientPmAssignees,
        );
        setPickerClientTotal(page.total);
        setPickerClientOffset(page.nextOffset);
      } catch (loadError) {
        if (request !== pickerClientRequest.current) return;
        console.error("Failed to load Payment Voucher clients", loadError);
        toast.error("Could not load clients", {
          description: "Please close the picker and try again.",
        });
      } finally {
        if (request === pickerClientRequest.current) {
          setPickerClientsLoading(false);
          setPickerClientsLoadingMore(false);
        }
      }
    },
    [],
  );
  useEffect(() => {
    if (!pickerOpen || selectedVoucherClientId) return;
    const timer = window.setTimeout(
      () => void loadPickerClientPage(0, false, pickerQuery),
      220,
    );
    return () => window.clearTimeout(timer);
  }, [loadPickerClientPage, pickerOpen, pickerQuery, selectedVoucherClientId]);
  const renderRelatedSubitemSelector = (clientId: string) => {
    const subitems = (clientsById.get(clientId)?.subitems ?? []).filter(
      (subitem) =>
        !subitem.customFields?.additionalCostId &&
        awardedOrLaterSubitemStatusIds.has(subitem.statusOptionId ?? ""),
    );
    const selected = subitems.filter((subitem) =>
      voucherDraft.relatedSubitemIds.includes(subitem.id),
    );
    return (
      <details
        ref={relatedSubitemsRef}
        open={relatedSubitemsOpen}
        onToggle={(event) => setRelatedSubitemsOpen(event.currentTarget.open)}
        className="relative mt-1 rounded border border-slate-300 bg-white"
      >
        <summary className="cursor-pointer list-none px-3 py-2 text-sm text-slate-700 marker:content-none">
          {selected.length
            ? selected.map((subitem) => subitem.name).join(", ")
            : "Select related subitems"}
        </summary>
        <div className="absolute left-0 right-0 z-20 max-h-52 overflow-y-auto border-t border-slate-200 bg-white p-2 shadow-lg">
          {subitems.length ? (
            subitems.map((subitem) => (
              <label
                key={subitem.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={voucherDraft.relatedSubitemIds.includes(subitem.id)}
                  onChange={() =>
                    setVoucherDraft((draft) => ({
                      ...draft,
                      relatedSubitemIds: draft.relatedSubitemIds.includes(
                        subitem.id,
                      )
                        ? draft.relatedSubitemIds.filter(
                          (id) => id !== subitem.id,
                        )
                        : [...draft.relatedSubitemIds, subitem.id],
                    }))
                  }
                />
                <span className="min-w-0 truncate">
                  {subitem.name || "Unnamed subitem"}
                </span>
                <span className="shrink-0 font-mono text-xs text-slate-400">
                  {subitem.displayId}
                </span>
              </label>
            ))
          ) : (
            <p className="px-2 py-3 text-sm text-slate-500">
              This client has no Awarded-or-later subitems.
            </p>
          )}
        </div>
      </details>
    );
  };
  const renderBoardRelatedSubitemSelector = (
    row: AdditionalCost,
    client: Client | undefined,
  ) => {
    const subitems = (client?.subitems ?? []).filter(
      (subitem) =>
        !subitem.customFields?.additionalCostId &&
        awardedOrLaterSubitemStatusIds.has(subitem.statusOptionId ?? ""),
    );
    const selectedNames = new Set(
      row.items_sent
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    );
    const selectedIds = subitems
      .filter((subitem) => selectedNames.has(subitem.name))
      .map((subitem) => subitem.id);
    const menuOpen = boardRelatedSubitemsMenu?.rowId === row.id;
    const lockedForPreviewEditing =
      row.voucher_group === "courier" || Boolean(row.is_draft);
    return (
      <>
        <button
          type="button"
          data-related-subitems-trigger
          disabled={!canDelete(row) || lockedForPreviewEditing}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setBoardRelatedSubitemsMenu(
              menuOpen
                ? null
                : {
                  rowId: row.id,
                  top: rect.bottom + 4,
                  left: rect.left,
                  width: rect.width,
                },
            );
          }}
          className="h-10 w-full truncate px-3 text-left hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {row.items_sent || "Select related subitems"}
        </button>
        {menuOpen &&
          createPortal(
            <div
              ref={boardRelatedSubitemsMenuRef}
              style={{
                position: "fixed",
                top: boardRelatedSubitemsMenu.top,
                left: boardRelatedSubitemsMenu.left,
                width: Math.max(288, boardRelatedSubitemsMenu.width),
                zIndex: 500,
              }}
              className="max-h-52 overflow-y-auto rounded border border-slate-200 bg-white p-2 shadow-xl"
            >
              {subitems.map((subitem) => (
                <label
                  key={subitem.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    disabled={!canDelete(row)}
                    checked={selectedIds.includes(subitem.id)}
                    onChange={() => {
                      const nextIds = selectedIds.includes(subitem.id)
                        ? selectedIds.filter((id) => id !== subitem.id)
                        : [...selectedIds, subitem.id];
                      const names = subitems
                        .filter((item) => nextIds.includes(item.id))
                        .map((item) => item.name)
                        .join(", ");
                      void update(row.id, {
                        relatedSubitemIds: nextIds,
                        items_sent: names,
                      });
                    }}
                  />
                  <span className="min-w-0 truncate">
                    {subitem.name || "Unnamed subitem"}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-slate-400">
                    {subitem.displayId}
                  </span>
                </label>
              ))}
            </div>,
            document.body,
          )}
      </>
    );
  };
  const cell = (content: React.ReactNode, key: string) => (
    <div key={key} className="min-w-0 border-b border-r border-slate-200">
      {content}
    </div>
  );
  const voucherGroups = [
    {
      id: "courier" as const,
      name: "Lalamove/Easyparcel/Replacements/Additional Costs",
      rows: rows.filter((row) =>
        row.voucher_group === "courier" ||
        (!row.voucher_group &&
          Boolean(
            row.courier_option_id &&
              courierVoucherOptionIds.has(row.courier_option_id),
          )),
      ),
      accent: "#16a5c4",
    },
    {
      id: "other" as const,
      name: "Manpower/UPS Charges/Other payments",
      rows: rows.filter(
        (row) =>
          row.voucher_group !== "quickbooks_bills_only" &&
          row.voucher_group !== "courier" &&
          (Boolean(row.voucher_group) ||
            !row.courier_option_id ||
            !courierVoucherOptionIds.has(row.courier_option_id)),
      ),
      accent: "#8b5cf6",
    },
    ...(["admin", "director", "dev"].includes(
      String(currentUserRole ?? "").toLowerCase(),
    )
      ? [
        {
          id: "quickbooks_bills_only" as const,
          name: "QuickBooks Bills only",
          rows: rows.filter(
            (row) => row.voucher_group === "quickbooks_bills_only",
          ),
          accent: "#f59e0b",
        },
      ]
      : []),
  ];
  const openVoucherCreator = (groupId: (typeof voucherGroups)[number]["id"]) => {
    setPickerQuery("");
    setExpandedPickerGroups(
      new Set([...groups.map((group) => group.id), "ungrouped"]),
    );
    setVoucherCreationGroup(groupId);
    setQuickBooksBillOnlyMode(groupId === "quickbooks_bills_only");
    setSelectedVoucherClientId(null);
    setOtherBillChoice(groupId === "quickbooks_bills_only" ? "add" : null);
    setBillTargetVoucher(null);
    setEditingVoucher(null);
    setEditingQuickBooksBill(false);
    setBillDocumentPreview(null);
    setPrefillFileSignature(null);
    setVoucherDraft({
      cost: "",
      reason: "",
      reasonOptionId: "",
      relatedSubitemIds: [],
      courier: "",
      remarks: "",
      orderNumber: "",
      modeOfPayment: "",
      modeOfPaymentOptionId: "",
    });
    const today = new Date().toISOString().slice(0, 10);
    setBillDraft({
      supplierId: "",
      supplierName: "",
      mailingAddress: "",
      termId: "",
      billDate: today,
      dueDate: today,
      billNumber: "",
      memo: "",
      overallGstAmount: "",
      attachments: [],
      lines: [{ categoryId: "", categoryName: "", description: "", amount: "", taxCodeId: "" }],
    });
    setPickerOpen(true);
  };
  const renderVoucherGroup = (group: (typeof voucherGroups)[number]) => {
    const baseColumns =
      group.id === "courier"
        ? initialColumns
        : group.id === "other"
          ? otherVoucherColumns
          : quickBooksBillsOnlyColumns;
    const layout = voucherColumnLayouts[group.id];
    const tableColumns = layout.order
      .map((key) => baseColumns.find((column) => column.key === key))
      .filter((column): column is Column => Boolean(column))
      .map((column) => ({
        ...column,
        width: layout.widths[column.key] ?? column.width,
      }));
    const columnGrid = tableColumns
      .map((column) => `${column.width}px`)
      .join(" ");
    const columnGridWidth = tableColumns.reduce(
      (total, column) => total + column.width,
      0,
    );
    return (
      <section
        key={group.id}
        className="relative rounded-lg border border-slate-200 bg-white shadow-sm"
        style={{ minWidth: columnGridWidth }}
      >
      <div
        className="flex w-full cursor-pointer items-center border-l-4 hover:bg-slate-50"
        style={{ borderLeftColor: group.accent }}
        onClick={() =>
          setCollapsedVoucherGroups((current) => ({
            ...current,
            [group.id]: !current[group.id],
          }))
        }
      >
        <div className="flex min-w-0 items-center gap-2 px-4 py-3 text-left">
          {collapsedVoucherGroups[group.id] ? (
            <ChevronRight size={18} style={{ color: group.accent }} />
          ) : (
            <ChevronDown size={18} style={{ color: group.accent }} />
          )}
          <span className="text-lg font-semibold text-slate-800">{group.name}</span>
          <span className="text-sm text-slate-500">{group.rows.length} vouchers</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openVoucherCreator(group.id);
          }}
          className="ml-2 rounded border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100"
        >
          {group.id === "quickbooks_bills_only"
            ? "+ Add QuickBooks Bill"
            : "+ Add payment voucher"}
        </button>
      </div>
        {!collapsedVoucherGroups[group.id] && (
          <div className="overflow-visible">
            <table
              data-voucher-group={group.id}
              className="min-w-full border-collapse text-sm"
            >
              <style>{`[data-voucher-group="${group.id}"] .payment-voucher-row>[data-voucher-col]{display:none;align-items:center;} ${tableColumns.map((column, index) => `[data-voucher-group="${group.id}"] .payment-voucher-row [data-voucher-col="${column.key}"]{display:flex;order:${index};}`).join("")} .deactivated-voucher-row [data-voucher-col]:not([data-voucher-col="activity"]):not([data-voucher-col="trip_id"]):not([data-voucher-col="actions"]){text-decoration:line-through;}`}</style>
              <thead className="sticky top-0 z-[77] bg-slate-50 text-left text-xs font-semibold text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.35)]">
                <tr
                  className="grid"
                  style={{ gridTemplateColumns: columnGrid }}
                >
                  {tableColumns.map((column) => (
                    <th
                      key={column.key}
                      draggable={column.key !== "actions"}
                      onDragStart={(event) => {
                        if (column.key === "actions") return;
                        event.dataTransfer.effectAllowed = "move";
                        setDraggedVoucherColumn({
                          group: group.id,
                          key: column.key,
                        });
                      }}
                      onDragOver={(event) => {
                        if (
                          !draggedVoucherColumn ||
                          draggedVoucherColumn.group !== group.id ||
                          draggedVoucherColumn.key === column.key
                        )
                          return;
                        event.preventDefault();
                        const edge =
                          event.clientX <
                            event.currentTarget.getBoundingClientRect().left +
                            event.currentTarget.getBoundingClientRect().width /
                            2
                            ? "left"
                            : "right";
                        setVoucherDropTarget({
                          group: group.id,
                          key: column.key,
                          edge,
                        });
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const dragged = draggedVoucherColumn;
                        const target = voucherDropTarget;
                        setDraggedVoucherColumn(null);
                        setVoucherDropTarget(null);
                        if (
                          !dragged ||
                          !target ||
                          dragged.group !== group.id ||
                          target.key === dragged.key
                        )
                          return;
                        setVoucherColumnLayouts((current) => {
                          const nextOrder = current[group.id].order.filter(
                            (key) => key !== dragged.key,
                          );
                          const targetIndex =
                            nextOrder.indexOf(target.key) +
                            (target.edge === "right" ? 1 : 0);
                          nextOrder.splice(targetIndex, 0, dragged.key);
                          const next = {
                            ...current,
                            [group.id]: {
                              ...current[group.id],
                              order: nextOrder,
                            },
                          };
                          saveVoucherColumnLayout(next);
                          return next;
                        });
                      }}
                      onDragEnd={() => {
                        setDraggedVoucherColumn(null);
                        setVoucherDropTarget(null);
                      }}
                      className={`relative whitespace-nowrap border-b border-r border-slate-200 px-3 py-3 last:border-r-0 ${voucherDropTarget?.group === group.id && voucherDropTarget.key === column.key ? (voucherDropTarget.edge === "left" ? "border-l-2 border-l-sky-500" : "border-r-2 border-r-sky-500") : ""}`}
                    >
                      {column.label}
                      <button
                        aria-label={`Resize ${column.label || "actions"} column`}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          resize(
                            group.id,
                            column.key,
                            event.clientX,
                            column.width,
                          );
                        }}
                        onDragStart={(event) => event.preventDefault()}
                        className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!group.rows.length ? (
                  <tr>
                    <td
                      colSpan={tableColumns.length}
                      className="px-3 py-8 text-center text-sm text-slate-400"
                    >
                      No payment vouchers in this group yet.
                    </td>
                  </tr>
                ) : (
                  group.rows.map((row) => {
                    const client = clientsById.get(row.client_id);
                    const project = projectForVoucher(row);
                    const displayedBillMemo =
                      row.quickbooks_memo ||
                      (row.is_draft ? row.draft_bill?.memo?.trim() : "") ||
                      "";
                    return (
                      <tr
                        key={row.id}
                        className={`payment-voucher-row grid hover:bg-slate-50 ${row.deactivated_at
                          ? "deactivated-voucher-row bg-slate-50 opacity-60"
                          : ""
                          }`}
                        style={{ gridTemplateColumns: columnGrid }}
                      >
                        <td
                          data-voucher-col="activity"
                          className="border-b border-r border-slate-200 p-0"
                        >
                          <button
                            type="button"
                            onClick={() => void openActivity(row)}
                            className="flex h-full min-h-10 w-full items-center justify-center text-slate-500 hover:bg-sky-50 hover:text-sky-700"
                            title="View Payment Voucher activity log"
                          >
                            <History size={16} />
                          </button>
                        </td>
                        <td
                          data-voucher-col="project"
                          className="border-b border-r border-slate-200 px-3 py-2 font-medium text-slate-700"
                        >
                          {project && !project.deleted ? (
                            <button
                              type="button"
                              onClick={() => onOpenProject?.(project.id)}
                              className="max-w-full truncate text-left text-sky-700 hover:underline"
                              title={`Open ${project.label} on the CRM Board`}
                            >
                              {project.label}
                            </button>
                          ) : (
                            "Deleted client"
                          )}
                        </td>
                        <td
                          data-voucher-col="cost"
                          className="border-b border-r border-slate-200 p-0"
                        >
                          <input
                            key={`${row.id}-cost-${row.cost ?? ""}`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            defaultValue={row.cost ?? ""}
                            disabled={
                              !canDelete(row) ||
                              String(group.id) === "quickbooks_bills_only" ||
                              String(group.id) === "courier"
                            }
                            onBlur={(event) =>
                              event.target.value !== String(row.cost ?? "") &&
                              void update(row.id, { cost: event.target.value })
                            }
                            title={
                              String(group.id) === "quickbooks_bills_only"
                                ? "Calculated from the QuickBooks Bill expense-line total."
                                : undefined
                            }
                            className="h-10 w-full bg-transparent px-3 text-right outline-none focus:bg-sky-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100"
                          />
                        </td>
                        <td
                          data-voucher-col="reason"
                          className="min-h-10 h-full border-b border-r border-slate-200 p-0"
                        >
                          <StatusBadge
                            value={row.reason}
                            onChange={(reason, option) => {
                              if (
                                option?.id === otherReasonOptionId &&
                                !row.remarks.trim()
                              ) {
                                toast.error(
                                  "Remarks is required when Reason is Other.",
                                );
                                return;
                              }
                              void update(row.id, { reason });
                            }}
                            options={labelOptions.additional_cost_reason ?? []}
                            onAddOption={(value) =>
                              manageLabel(
                                "additional_cost_reason",
                                "add",
                                value,
                              )
                            }
                            onDeleteOption={(value, optionId) =>
                              deleteLabel(
                                "additional_cost_reason",
                                value,
                                optionId,
                              )
                            }
                            onUpdateOptionColor={(value, color, optionId) =>
                              manageLabel(
                                "additional_cost_reason",
                                "color",
                                value,
                                color,
                                optionId,
                              )
                            }
                            onRenameOption={(value, nextValue, optionId) =>
                              manageLabel(
                                "additional_cost_reason",
                                "rename",
                                value,
                                nextValue,
                                optionId,
                              )
                            }
                            onReorderOptions={(layout) =>
                              reorderLabels("additional_cost_reason", layout)
                            }
                            manageLabel="reason"
                            readOnly={!canDelete(row) || String(group.id) === "courier"}
                          />
                        </td>
                        <td
                          data-voucher-col="remarks"
                          className="border-b border-r border-slate-200 p-0"
                        >
                          <input
                            key={`${row.id}-remarks-${row.remarks}`}
                            defaultValue={row.remarks}
                            disabled={!canDelete(row) || String(group.id) === "courier"}
                            onBlur={(event) =>
                              event.target.value !== row.remarks &&
                              void update(row.id, {
                                remarks: event.target.value,
                              })
                            }
                            className="h-10 w-full bg-transparent px-3 outline-none focus:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </td>
                        <td
                          data-voucher-col="trip_id"
                          className="border-b border-r border-slate-200 px-3 py-2"
                        >
                          {row.trip_id}
                        </td>
                        <td
                          data-voucher-col="items_sent"
                          className="border-b border-r border-slate-200 p-0"
                        >
                          {renderBoardRelatedSubitemSelector(row, client)}
                        </td>
                        {group.id === "courier" ? (
                          <td
                            data-voucher-col="courier"
                            className="min-h-10 h-full border-b border-r border-slate-200 p-0"
                          >
                            <StatusBadge
                              value={row.courier}
                              onChange={(courier) =>
                                void update(row.id, { courier })
                              }
                              options={labelOptions.additional_cost_courier ?? []}
                              readOnly={!canDelete(row) || String(group.id) === "courier"}
                              onAddOption={(value) =>
                                manageLabel(
                                  "additional_cost_courier",
                                  "add",
                                  value,
                                )
                              }
                              onDeleteOption={(value, optionId) =>
                                deleteLabel(
                                  "additional_cost_courier",
                                  value,
                                  optionId,
                                )
                              }
                              onUpdateOptionColor={(value, color, optionId) =>
                                manageLabel(
                                  "additional_cost_courier",
                                  "color",
                                  value,
                                  color,
                                  optionId,
                                )
                              }
                              onRenameOption={(value, nextValue, optionId) =>
                                manageLabel(
                                  "additional_cost_courier",
                                  "rename",
                                  value,
                                  nextValue,
                                  optionId,
                                )
                              }
                              onReorderOptions={(layout) =>
                                reorderLabels(
                                  "additional_cost_courier",
                                  layout,
                                )
                              }
                              manageLabel="courier"
                              sectionCount={1}
                            />
                          </td>
                        ) : (
                          <>
                            <td
                              data-voucher-col="has_quickbooks_bill"
                              className="min-h-10 h-full border-b border-r border-slate-200 bg-slate-100 p-0"
                            >
                              <StatusBadge
                                value={
                                  row.quickbooks_bill_sync_error ||
                                  (row.has_quickbooks_bill ? "Yes" : "No")
                                }
                                onChange={() => undefined}
                                options={[
                                  { value: "Yes", color: "#16a34a" },
                                  { value: "No", color: "#94a3b8" },
                                  {
                                    value: "ERROR - Could not find Bill",
                                    color: "#dc2626",
                                  },
                                ]}
                                includeBlankOption={false}
                                readOnly
                                readOnlyReason={
                                  row.quickbooks_bill_sync_error
                                    ? "QuickBooks could not retrieve this linked Bill."
                                    : "QuickBooks Bill status is managed automatically."
                                }
                              />
                            </td>
                            <td
                              data-voucher-col="quickbooks_invoice_number"
                              className="border-b border-r border-slate-200 bg-slate-100 p-0"
                            >
                              <input
                                key={`${row.id}-invoice-${row.quickbooks_invoice_number ?? ""}-${row.has_quickbooks_bill}`}
                                defaultValue={
                                  row.quickbooks_invoice_number ?? ""
                                }
                                disabled
                                className="h-10 w-full bg-transparent px-3 outline-none focus:bg-sky-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                              />
                            </td>
                            <td
                              data-voucher-col="quickbooks_supplier_name"
                              className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-400"
                            >
                              <span className="block truncate">
                                {row.quickbooks_supplier_name || "—"}
                              </span>
                            </td>
                            <td
                              data-voucher-col="quickbooks_memo"
                              className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                              title={displayedBillMemo}
                            >
                              <span className="block truncate">
                                {displayedBillMemo || "-"}
                              </span>
                            </td>
                            <td
                              data-voucher-col="quickbooks_overall_gst_override"
                              className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-right text-sm text-slate-400"
                              title="Managed from the QuickBooks Bill"
                            >
                              {row.quickbooks_overall_gst_override ?? ""}
                            </td>
                            <td
                              data-voucher-col="quickbooks_total_cost"
                              className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-right text-sm font-medium text-slate-500"
                              title="Cost + GST Amount"
                            >
                              {(
                                Number(row.cost ?? 0) +
                                Number(row.quickbooks_overall_gst_override ?? 0)
                              ).toFixed(2)}
                            </td>
                            <td
                              data-voucher-col="quickbooks_attachment_files"
                              className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-400"
                            >
                              {row.quickbooks_attachment_files?.length ? (
                                <div
                                  className="flex flex-wrap gap-1"
                                  title={row.quickbooks_attachment_files
                                    .map((file) => file.name ?? "Unnamed file")
                                    .join(", ")}
                                >
                                  {row.quickbooks_attachment_files.map(
                                    (file, index) =>
                                      file.url ? (
                                        <a
                                          key={`${file.id ?? file.name ?? "file"}-${index}`}
                                          href={file.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          title={file.name || "Open file"}
                                          className="h-8 w-9 overflow-hidden rounded border border-sky-200 bg-sky-50 hover:border-sky-400"
                                        >
                                          <FilePreview
                                            url={file.url}
                                            name={file.name || "Attachment"}
                                            mimeType={file.contentType}
                                            className="h-full w-full border-0"
                                          />
                                        </a>
                                      ) : (
                                        <span
                                          key={`${file.id ?? file.name ?? "file"}-${index}`}
                                          className="max-w-24 truncate"
                                        >
                                          {file.name || "Unnamed file"}
                                        </span>
                                      ),
                                  )}
                                </div>
                              ) : null}
                            </td>
                            <td
                              data-voucher-col="bill_action"
                              className="border-b border-r border-slate-200 px-2 py-1"
                            >
                              {row.is_draft ? (
                                <button
                                  type="button"
                                  disabled
                                  title="Continue and complete this draft before working with a QuickBooks Bill."
                                  className="w-full cursor-not-allowed rounded bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-400"
                                >
                                  Complete draft first
                                </button>
                              ) : row.isGeneratingQuickBooksBill ? (
                                <div className="flex h-8 items-center justify-center gap-1 rounded bg-amber-50 px-2 text-xs font-semibold text-amber-700">
                                  <LoaderCircle size={14} className="animate-spin" />
                                  Generating…
                                </div>
                              ) : row.has_quickbooks_bill ? (
                                <div className="space-y-1">
                                  <button
                                    type="button"
                                    disabled={
                                      !canDelete(row) || creatingFor === row.id
                                    }
                                    onClick={() => void openEditBill(row)}
                                    title={
                                      canDelete(row)
                                        ? "Load the latest QuickBooks Bill for editing"
                                        : "You can only edit payment vouchers for clients assigned to you"
                                    }
                                    className="w-full rounded bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                  >
                                    {creatingFor === row.id
                                      ? "Loading…"
                                      : "Edit bill"}
                                  </button>
                                  {row.quickbooks_bill_sync_error ? (
                                    <button
                                      type="button"
                                      disabled={!canDelete(row)}
                                      onClick={() =>
                                        setPendingBillErrorResolution(row)
                                      }
                                      className="w-full rounded bg-red-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                      Resolve error
                                    </button>
                                  ) : null}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!canDelete(row)}
                                  onClick={() => {
                                    setBillLinkVoucher(row);
                                    setBillLinkMode("choice");
                                    setBillLinkNumber("");
                                    setBillLinkResults([]);
                                    setBillLinkSearched(false);
                                  }}
                                  title={
                                    canDelete(row)
                                      ? "Create and link a QuickBooks Bill"
                                      : "You can only edit payment vouchers for clients assigned to you"
                                  }
                                  className="w-full rounded bg-sky-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                  Add bill
                                </button>
                              )}
                            </td>
                          </>
                        )}
                        <td
                          data-voucher-col="created"
                          title={`${new Date(row.created_at).toLocaleString("en-SG")}${row.created_by ? ` · Created by ${profiles.find((profile) => profile.id === row.created_by)?.full_name || profiles.find((profile) => profile.id === row.created_by)?.email || "Unknown user"}` : ""}`}
                          className="border-b border-slate-200 px-3 py-0"
                        >
                          <CreatorDate
                            createdAt={row.created_at}
                            createdBy={row.created_by}
                            profiles={profiles}
                          />
                        </td>
                        {String(group.id) !== "quickbooks_bills_only" ? (
                          <td
                            data-voucher-col="actions"
                            className="border-b border-slate-200 p-0 text-center"
                          >
                          {(String(group.id) === "courier" || row.is_draft) ? (
                            <button
                              type="button"
                              disabled={!canDelete(row) || creatingFor === row.id}
                              onClick={() => void openVoucherEditor(row)}
                              title={
                                row.deactivated_at
                                  ? "Deactivated payment vouchers cannot be edited."
                                  : canDelete(row)
                                    ? "Edit this payment voucher in the preview."
                                    : "Only admins, directors, or users currently assigned to this client as People or PM can edit this payment voucher."
                              }
                              className="inline-flex h-10 min-w-[150px] flex-1 items-center justify-center whitespace-nowrap bg-sky-50 px-3 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              {creatingFor === row.id
                                ? "Loading..."
                                : row.is_draft
                                  ? "Continue draft"
                                  : "Edit Payment Voucher"}
                            </button>
                          ) : null}
                          </td>
                        ) : null}
                        <td
                          data-voucher-col={
                            String(group.id) === "quickbooks_bills_only"
                              ? "actions"
                              : "deactivate"
                          }
                          className="border-b border-slate-200 p-0 text-center"
                        >
                          <button
                            type="button"
                            disabled={
                              !canDeactivate(row) ||
                              deletingId === row.id ||
                              row.isGeneratingQuickBooksBill
                            }
                            onClick={() => setPendingDelete(row)}
                            title={
                              canDeactivate(row)
                                ? String(group.id) === "quickbooks_bills_only"
                                  ? "Remove this row only; the QuickBooks Bill remains unchanged."
                                  : "Deactivate payment voucher and permanently remove linked subitem"
                                : String(group.id) === "quickbooks_bills_only"
                                  ? "Only admins, directors, and developers can delete QuickBooks-Bills-only rows."
                                  : "You can only edit payment vouchers for clients assigned to you"
                            }
                            className="inline-flex h-10 w-full items-center justify-center gap-1 whitespace-nowrap bg-red-50 px-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Trash2 size={14} /> Deactivate
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {!collapsedVoucherGroups[group.id] &&
          String(group.id) !== "quickbooks_bills_only" && (
          <div className="border-t border-slate-200 px-3 py-2">
            <button
              type="button"
            onClick={() => openVoucherCreator(group.id)}
              className="text-sm font-medium text-sky-700 hover:text-sky-800"
            >
              {group.id === "quickbooks_bills_only"
                ? "+ Add QuickBooks Bill"
                : "+ Add payment voucher"}
            </button>
          </div>
        )}
      </section>
    );
  };
  return (
    <section className="crm-board min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Payment Voucher
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review payment vouchers grouped by courier and other payments.
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-10 text-center text-sm text-slate-400">
            Loading payment vouchers…
          </div>
        ) : (
          voucherGroups.map(renderVoucherGroup)
        )}
      </div>
      <div className="hidden w-max min-w-full rounded-lg border border-slate-200 bg-white shadow-sm">
        <div>
          <div
            className="grid bg-slate-50 text-xs font-semibold text-slate-500"
            style={{ gridTemplateColumns }}
          >
            {columns.map((column) => (
              <div
                key={column.key}
                className="relative h-11 whitespace-nowrap border-b border-r border-slate-200 px-2 leading-[44px]"
              >
                {column.label}
                <button
                  aria-label={`Resize ${column.label || "actions"} column`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    resize("courier", column.key, event.clientX, column.width);
                  }}
                  className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize"
                />
              </div>
            ))}
          </div>
          {loading ? (
            <div className="px-3 py-10 text-center text-sm text-slate-400">
              Loading Additional Costs…
            </div>
          ) : null}
          {!loading && !rows.length ? (
            <div className="px-3 py-10 text-center text-sm text-slate-400">
              No additional costs yet. Add one by choosing a client.
            </div>
          ) : null}
          {rows.map((row) => {
            const project = projectForVoucher(row);
            return (
              <div
                key={row.id}
                className={`grid hover:bg-slate-50 ${row.deactivated_at ? "deactivated-voucher-row bg-slate-50 opacity-60" : ""}`}
                style={{ gridTemplateColumns }}
              >
                {cell(
                  <div className="flex h-10 items-center truncate px-2 text-sm font-medium text-slate-700">
                    {project && !project.deleted ? project.label : "Deleted client"}
                  </div>,
                  "project",
                )}
                {cell(
                  <input
                    type="date"
                    value={row.date_sent ?? ""}
                    onChange={(event) =>
                      void update(row.id, {
                        date_sent: event.target.value || null,
                      })
                    }
                    className={`${cellClass} w-full`}
                  />,
                  "date_sent",
                )}
                {cell(
                  <div className="flex h-10 w-full items-center justify-center [&>div]:w-full">
                    <AssigneeMultiSelect
                      profiles={profiles.filter(
                        (profile) => profile.role?.toLowerCase() !== "shipper",
                      )}
                      selectedIds={
                        row.people_ids ?? (row.people_id ? [row.people_id] : [])
                      }
                      onChange={(people_ids) =>
                        void update(row.id, { people_ids })
                      }
                    />
                  </div>,
                  "people",
                )}
                {cell(
                  <input
                    inputMode="decimal"
                    value={row.cost ?? ""}
                    onBlur={(event) =>
                      void update(row.id, {
                        cost:
                          event.target.value !== "" &&
                            Number.isFinite(Number(event.target.value))
                            ? event.target.value
                            : null,
                      })
                    }
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((candidate) =>
                          candidate.id === row.id
                            ? {
                              ...candidate,
                              cost: Number.isFinite(
                                Number(event.target.value),
                              )
                                ? Number(event.target.value)
                                : null,
                            }
                            : candidate,
                        ),
                      )
                    }
                    className={`${cellClass} w-full text-right`}
                  />,
                  "cost",
                )}
                {cell(
                  <input
                    defaultValue={row.remarks}
                    onBlur={(event) =>
                      event.target.value !== row.remarks &&
                      void update(row.id, { remarks: event.target.value })
                    }
                    className={`${cellClass} w-full`}
                  />,
                  "remarks",
                )}
                {cell(
                  <StatusBadge
                    value={row.status}
                    onChange={(status) => void update(row.id, { status })}
                    options={labelOptions.additional_cost_status ?? []}
                    onAddOption={(value) =>
                      manageLabel("additional_cost_status", "add", value)
                    }
                    onDeleteOption={(value, optionId) =>
                      deleteLabel("additional_cost_status", value, optionId)
                    }
                    onUpdateOptionColor={(value, color, optionId) =>
                      manageLabel(
                        "additional_cost_status",
                        "color",
                        value,
                        color,
                        optionId,
                      )
                    }
                    onRenameOption={(value, nextValue, optionId) =>
                      manageLabel(
                        "additional_cost_status",
                        "rename",
                        value,
                        nextValue,
                        optionId,
                      )
                    }
                    onReorderOptions={(layout) =>
                      reorderLabels("additional_cost_status", layout)
                    }
                    manageLabel="status"
                  />,
                  "status",
                )}
                {cell(
                  <StatusBadge
                    value={row.reason}
                    onChange={(reason) => void update(row.id, { reason })}
                    options={labelOptions.additional_cost_reason ?? []}
                    onAddOption={(value) =>
                      manageLabel("additional_cost_reason", "add", value)
                    }
                    onDeleteOption={(value, optionId) =>
                      deleteLabel("additional_cost_reason", value, optionId)
                    }
                    onUpdateOptionColor={(value, color, optionId) =>
                      manageLabel(
                        "additional_cost_reason",
                        "color",
                        value,
                        color,
                        optionId,
                      )
                    }
                    onRenameOption={(value, nextValue, optionId) =>
                      manageLabel(
                        "additional_cost_reason",
                        "rename",
                        value,
                        nextValue,
                        optionId,
                      )
                    }
                    onReorderOptions={(layout) =>
                      reorderLabels("additional_cost_reason", layout)
                    }
                    manageLabel="reason"
                  />,
                  "reason",
                )}
                {cell(
                  <StatusBadge
                    value={row.courier}
                    onChange={(courier) => void update(row.id, { courier })}
                    options={labelOptions.additional_cost_courier ?? []}
                    onAddOption={(value) =>
                      manageLabel("additional_cost_courier", "add", value)
                    }
                    onDeleteOption={(value, optionId) =>
                      deleteLabel("additional_cost_courier", value, optionId)
                    }
                    onUpdateOptionColor={(value, color, optionId) =>
                      manageLabel(
                        "additional_cost_courier",
                        "color",
                        value,
                        color,
                        optionId,
                      )
                    }
                    onRenameOption={(value, nextValue, optionId) =>
                      manageLabel(
                        "additional_cost_courier",
                        "rename",
                        value,
                        nextValue,
                        optionId,
                      )
                    }
                    onReorderOptions={(layout) =>
                      reorderLabels("additional_cost_courier", layout)
                    }
                    manageLabel="courier"
                  />,
                  "courier",
                )}
                {(["trip_id", "items_sent", "qty"] as const).map((field) =>
                  cell(
                    <input
                      defaultValue={row[field]}
                      onBlur={(event) =>
                        event.target.value !== row[field] &&
                        void update(row.id, { [field]: event.target.value })
                      }
                      className={`${cellClass} w-full`}
                    />,
                    field,
                  ),
                )}
                {cell(
                  <div
                    title={`${new Date(row.created_at).toLocaleString("en-SG")}${row.created_by ? ` · Created by ${profiles.find((profile) => profile.id === row.created_by)?.full_name || profiles.find((profile) => profile.id === row.created_by)?.email || "Unknown user"}` : ""}`}
                    className="contents"
                  >
                    <CreatorDate
                      createdAt={row.created_at}
                      createdBy={row.created_by}
                      profiles={profiles}
                    />
                  </div>,
                  "created",
                )}
                {(["verified", "discussed"] as const).map((field) =>
                  cell(
                    <button
                      aria-label={field}
                      onClick={() =>
                        void update(row.id, { [field]: !row[field] })
                      }
                      className="mx-auto flex h-10 w-full items-center justify-center"
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded border ${row[field] ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent"}`}
                      >
                        <Check size={13} />
                      </span>
                    </button>,
                    field,
                  ),
                )}
                {cell(
                  <button
                    disabled={deletingId === row.id || !canDeactivate(row)}
                    title={
                      canDeactivate(row)
                        ? "Deactivate Payment Voucher"
                        : "Only users assigned to this client can delete it"
                    }
                    onClick={() => setPendingDelete(row)}
                    className="flex h-10 w-full items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Deactivate Payment Voucher"
                  >
                    <Trash2 size={15} />
                  </button>,
                  "actions",
                )}
              </div>
            );
          })}
        </div>
      </div>
      {error ? <p className="m-3 text-sm text-red-600">{error}</p> : null}
      {pickerOpen ? (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center gap-5 bg-slate-950/35 p-4"
          role="dialog"
          aria-modal="true"
        >
          {billDocumentPreview ? (
            <aside className="hidden h-[calc(100vh-2rem)] w-[clamp(360px,36vw,680px)] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xl lg:flex lg:flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium text-slate-700"
                    title={billDocumentPreview.name}
                  >
                    {billDocumentPreview.name}
                  </p>
                  {billDocumentPreview.isPrefill ? (
                    <span className="text-xs font-medium text-sky-700">
                      Used for prefill
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">
                      Attachment preview
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setBillDocumentPreview(null)}
                  className="ml-2 rounded p-1 text-slate-500 hover:bg-slate-100"
                  aria-label="Hide document preview"
                >
                  <X size={16} />
                </button>
              </div>
              {billDocumentPreview.type === "application/pdf" ? (
                <iframe
                  title="Uploaded receipt or invoice"
                  src={billDocumentPreview.url}
                  className="min-h-0 flex-1 w-full bg-white"
                />
              ) : (
                <div className="min-h-0 flex-1 overflow-auto p-2">
                  {/* Object URLs are browser-local uploads and cannot use Next's image optimiser. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={billDocumentPreview.url}
                    alt="Uploaded receipt or invoice"
                    className="w-full"
                  />
                </div>
              )}
              {Object.keys(billDocumentPreview.confidence).length ? (
                <div className="border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  Extraction confidence:{" "}
                  {Object.values(billDocumentPreview.confidence).filter(Boolean)
                    .length
                    ? `${Math.round(
                      (Object.values(billDocumentPreview.confidence)
                        .filter(Boolean)
                        .reduce((total, value) => total + value, 0) /
                        Object.values(billDocumentPreview.confidence).filter(
                          Boolean,
                        ).length) *
                      100,
                    )}%`
                    : "not available"}
                  . Verify all prefilled fields.
                </div>
              ) : null}
            </aside>
          ) : null}
          <div
            className={`flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl ${billDocumentPreview ? "max-w-none flex-1" : "max-w-6xl"}`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-800">
                  {quickBooksBillOnlyMode
                    ? "Create QuickBooks Bill"
                    : selectedVoucherClientId
                      ? billTargetVoucher ||
                        (voucherCreationGroup === "other" &&
                          otherBillChoice === "add")
                        ? "Prepare QuickBooks Bill"
                        : editingVoucher
                          ? "Edit Payment Voucher"
                          : "Payment voucher details"
                      : "Choose a client"}
                </h2>
                {selectedVoucherClientId || quickBooksBillOnlyMode ? (
                  <p className="mt-0.5 text-sm text-slate-500">
                    {quickBooksBillOnlyMode
                      ? "Create a QuickBooks Bill without a linked CRM client or subitem."
                      : billTargetVoucher
                        ? "Create a QuickBooks Bill for this existing payment voucher."
                        : "Complete the required payment voucher information."}
                  </p>
                ) : null}
                <p
                  className={`mt-0.5 text-sm text-slate-500 ${selectedVoucherClientId || quickBooksBillOnlyMode ? "hidden" : ""}`}
                >
                  The client becomes this record’s Project Name.
                </p>
              </div>
              <button
                onClick={requestClosePaymentVoucherPreview}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>
            {selectedVoucherClientId || quickBooksBillOnlyMode ? (
              voucherCreationGroup !== "courier" ? (
                <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
                  {!billTargetVoucher && !quickBooksBillOnlyMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVoucherClientId(null);
                        setOtherBillChoice(null);
                        setBillDocumentPreview(null);
                        setPrefillFileSignature(null);
                      }}
                      className="text-sm text-sky-700 hover:underline"
                    >
                      Change project
                    </button>
                  ) : null}
                  {!quickBooksBillOnlyMode ? (
                    <section>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Project Name
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {clientLabel(
                          clientsById.get(selectedVoucherClientId!)!,
                        )}
                      </p>
                    </section>
                  ) : null}
                  {!billTargetVoucher &&
                    !quickBooksBillOnlyMode &&
                    otherBillChoice === null ? (
                    <section className="border-t border-slate-200 pt-4">
                      <h3 className="font-semibold text-slate-800">Bill</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Does this payment voucher need a QuickBooks Bill?
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setOtherBillChoice("add")}
                          className="rounded-lg border border-sky-500 bg-sky-100 px-6 py-5 text-left text-lg font-semibold text-sky-900 shadow-sm transition hover:bg-sky-200"
                        >
                          Add a Bill
                          <span className="mt-2 block text-sm font-normal text-sky-800">
                            Prepare the Bill details to send to QuickBooks.
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOtherBillChoice("none")}
                          className="rounded-lg border border-violet-400 bg-violet-100 px-6 py-5 text-left text-lg font-semibold text-violet-900 shadow-sm transition hover:bg-violet-200"
                        >
                          No Bill to add
                          <span className="mt-2 block text-sm font-normal text-violet-800">
                            Continue with a payment voucher only.
                          </span>
                        </button>
                      </div>
                    </section>
                  ) : (
                    <>
                      <section className="order-2 border-t border-slate-200 pt-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-800">
                              Bill
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              {otherBillChoice === "none"
                                ? "No QuickBooks Bill will be created for this voucher."
                                : editingQuickBooksBill
                                  ? "Loaded from QuickBooks just now. Review and update the Bill when ready."
                                  : "Complete the details for the QuickBooks Bill."}
                            </p>
                          </div>
                          {!billTargetVoucher ? (
                            <button
                              type="button"
                              onClick={() => setOtherBillChoice(null)}
                              className="text-sm text-sky-700 hover:underline"
                            >
                              Change
                            </button>
                          ) : null}
                        </div>
                        {otherBillChoice === "add" ? (
                          <div className="mt-4 space-y-4">
                            <FileDropTarget
                              disabled={extractingBillDocument}
                              onFiles={(files) => {
                                const file = files[0];
                                if (!file) return;
                                if (prefillFileSignature)
                                  setPendingExtractionFile(file);
                                else void extractBillDocument(file);
                              }}
                            >
                            <label className="block rounded-lg border border-dashed border-sky-300 bg-sky-50 p-3 text-sm font-medium text-slate-700">
                              Upload Receipt/Invoice for Pre-filling
                              <span className="mt-1 block text-xs font-normal text-slate-500">
                                Maximum 1 upload here for pre-filling, upload
                                other files below.
                              </span>
                              <span className="mt-1 block text-xs font-normal text-slate-500">
                                PDF, JPEG, PNG, TIFF, BMP, or HEIF up to 4 MB.
                                You can also paste a copied image here.
                                The original file is also added to the Bill
                                attachments.
                              </span>
                              <input
                                type="file"
                                accept="application/pdf,image/jpeg,image/png,image/tiff,image/bmp,image/heif"
                                disabled={extractingBillDocument}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  event.currentTarget.value = "";
                                  if (!file) return;
                                  if (prefillFileSignature)
                                    setPendingExtractionFile(file);
                                  else void extractBillDocument(file);
                                }}
                                className="mt-2 block w-full text-sm font-normal text-slate-600"
                              />
                              {extractingBillDocument ? (
                                <span className="mt-3 flex items-center gap-2 rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white">
                                  <LoaderCircle
                                    size={18}
                                    className="animate-spin"
                                  />{" "}
                                  Reading file and extracting Bill details…
                                </span>
                              ) : null}
                            </label>
                            </FileDropTarget>
                            {billOptionsLoading ? (
                              <p className="text-sm text-slate-500">
                                Loading QuickBooks options…
                              </p>
                            ) : null}
                            {billOptionsError ? (
                              <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                {billOptionsError}
                              </p>
                            ) : null}
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="text-sm font-medium text-slate-700">
                                Supplier *
                                <div className="relative mt-1">
                                  <input
                                    required
                                    value={billDraft.supplierName}
                                    onFocus={() => setSupplierOptionsOpen(true)}
                                    onBlur={() =>
                                      window.setTimeout(
                                        () => setSupplierOptionsOpen(false),
                                        120,
                                      )
                                    }
                                    onChange={(event) => {
                                      const supplierName = event.target.value;
                                      const match = billOptions.vendors.find(
                                        (option) =>
                                          option.name.toLocaleLowerCase() ===
                                          supplierName
                                            .trim()
                                            .toLocaleLowerCase(),
                                      );
                                      setBillDraft((draft) => ({
                                        ...draft,
                                        supplierName,
                                        supplierId: match?.id ?? "",
                                      }));
                                      setSupplierOptionsOpen(true);
                                    }}
                                    placeholder="Choose or type a supplier"
                                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-normal"
                                  />
                                  {supplierOptionsOpen ? (
                                    <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
                                      {billOptions.vendors
                                        .filter(
                                          (option) =>
                                            !billDraft.supplierName ||
                                            option.name
                                              .toLocaleLowerCase()
                                              .includes(
                                                billDraft.supplierName.toLocaleLowerCase(),
                                              ),
                                        )
                                        .map((option) => (
                                          <button
                                            key={option.id}
                                            type="button"
                                            onMouseDown={(event) =>
                                              event.preventDefault()
                                            }
                                            onClick={() => {
                                              setBillDraft((draft) => ({
                                                ...draft,
                                                supplierId: option.id,
                                                supplierName: option.name,
                                              }));
                                              setSupplierOptionsOpen(false);
                                            }}
                                            className="block w-full px-3 py-2 text-left text-sm hover:bg-sky-50"
                                          >
                                            {option.name}
                                          </button>
                                        ))}
                                    </div>
                                  ) : null}
                                </div>
                                {supplierExtraction?.suggestion &&
                                  billDraft.supplierId !==
                                  supplierExtraction.suggestion.id ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setBillDraft((draft) => ({
                                        ...draft,
                                        supplierId:
                                          supplierExtraction.suggestion!.id,
                                        supplierName:
                                          supplierExtraction.suggestion!.name,
                                      }))
                                    }
                                    className="mt-1 text-left text-xs font-normal text-sky-700 hover:underline"
                                  >
                                    Use closest match:{" "}
                                    {supplierExtraction.suggestion.name}
                                  </button>
                                ) : null}
                                {!supplierExtraction?.suggestion &&
                                  !billDraft.supplierId &&
                                  closestQuickBooksOption(
                                    billDraft.supplierName,
                                    billOptions.vendors,
                                  ) ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const match = closestQuickBooksOption(
                                        billDraft.supplierName,
                                        billOptions.vendors,
                                      )!;
                                      setBillDraft((draft) => ({
                                        ...draft,
                                        supplierId: match.id,
                                        supplierName: match.name,
                                      }));
                                    }}
                                    className="mt-1 text-left text-xs font-normal text-sky-700 hover:underline"
                                  >
                                    Use closest match:{" "}
                                    {
                                      closestQuickBooksOption(
                                        billDraft.supplierName,
                                        billOptions.vendors,
                                      )!.name
                                    }
                                  </button>
                                ) : null}
                                {supplierExtraction?.name ? (
                                  <span className="mt-1 block text-xs font-normal text-slate-500">
                                    Extracted: {supplierExtraction.name}
                                  </span>
                                ) : null}
                              </label>
                              <label className="text-sm font-medium text-slate-700">
                                Terms
                                <select
                                  value={billDraft.termId}
                                  onChange={(event) =>
                                    setBillDraft((draft) => ({
                                      ...draft,
                                      termId: event.target.value,
                                    }))
                                  }
                                  className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 font-normal"
                                >
                                  <option value="">Choose terms</option>
                                  {billOptions.terms.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                                Mailing Address
                                <textarea
                                  value={billDraft.mailingAddress}
                                  onChange={(event) =>
                                    setBillDraft((draft) => ({
                                      ...draft,
                                      mailingAddress: event.target.value,
                                    }))
                                  }
                                  className="mt-1 min-h-20 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                                />
                              </label>
                              <label className="text-sm font-medium text-slate-700">
                                Bill date
                                <input
                                  type="date"
                                  value={billDraft.billDate}
                                  onChange={(event) =>
                                    setBillDraft((draft) => ({
                                      ...draft,
                                      billDate: event.target.value,
                                    }))
                                  }
                                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                                />
                              </label>
                              <label className="text-sm font-medium text-slate-700">
                                Due date
                                <input
                                  type="date"
                                  value={billDraft.dueDate}
                                  onChange={(event) =>
                                    setBillDraft((draft) => ({
                                      ...draft,
                                      dueDate: event.target.value,
                                    }))
                                  }
                                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                                />
                              </label>
                              <label className="text-sm font-medium text-slate-700">
                                Invoice no. *{" "}
                                <span className="font-normal text-slate-500">
                                  (Bill no. on QuickBooks)
                                </span>
                                <input
                                  required
                                  value={billDraft.billNumber}
                                  onChange={(event) =>
                                    setBillDraft((draft) => ({
                                      ...draft,
                                      billNumber: event.target.value,
                                    }))
                                  }
                                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                                />
                              </label>
                            </div>
                            <div>
                              <p className="mb-2 text-sm font-semibold text-slate-700">
                                Expense lines
                              </p>
                              <div className="overflow-x-auto rounded-md border border-slate-200">
                                <table className="min-w-[950px] w-full text-sm">
                                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr>
                                      <th className="w-14 px-3 py-2 text-center">
                                        #
                                      </th>
                                      <th className="px-3 py-2">Category *</th>
                                      <th className="px-3 py-2">Description</th>
                                      <th className="px-3 py-2">Amount *</th>
                                      <th className="px-3 py-2">GST *</th>
                                      <th className="w-24 px-3 py-2">
                                        <span className="sr-only">Actions</span>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {billDraft.lines.map((line, index) => (
                                      <tr
                                        key={index}
                                        className="border-t border-slate-200 align-top"
                                      >
                                        <td className="px-3 py-2 text-center font-semibold text-slate-500">
                                          {index + 1}
                                        </td>
                                        <td className="px-3 py-2">
                                          <input
                                            required
                                            value={line.categoryName ?? ""}
                                            onFocus={(event) =>
                                              openCategoryOptions(
                                                index,
                                                event.currentTarget,
                                              )
                                            }
                                            onBlur={() =>
                                              window.setTimeout(
                                                () =>
                                                  setCategoryOptionsOpen(null),
                                                120,
                                              )
                                            }
                                            onChange={(event) => {
                                              const categoryName =
                                                event.target.value;
                                              const match =
                                                billOptions.accounts.find(
                                                  (option) =>
                                                    option.name.toLocaleLowerCase() ===
                                                    categoryName
                                                      .trim()
                                                      .toLocaleLowerCase(),
                                                );
                                              setBillDraft((draft) => ({
                                                ...draft,
                                                lines: draft.lines.map(
                                                  (current, currentIndex) =>
                                                    currentIndex === index
                                                      ? {
                                                        ...current,
                                                        categoryName,
                                                        categoryId:
                                                          match?.id ?? "",
                                                      }
                                                      : current,
                                                ),
                                              }));
                                              openCategoryOptions(
                                                index,
                                                event.currentTarget,
                                              );
                                            }}
                                            placeholder="Choose or type a category"
                                            className="w-full rounded border border-slate-300 px-3 py-2"
                                          />
                                          {categoryOptionsOpen?.index ===
                                            index &&
                                            typeof document !== "undefined"
                                            ? createPortal(
                                              <div
                                                style={{
                                                  position: "fixed",
                                                  top: categoryOptionsOpen.top,
                                                  left: categoryOptionsOpen.left,
                                                  width:
                                                    categoryOptionsOpen.width,
                                                  zIndex: 500,
                                                }}
                                                className="max-h-52 overflow-y-auto rounded border border-slate-200 bg-white shadow-xl"
                                              >
                                                {billOptions.accounts
                                                  .filter(
                                                    (option) =>
                                                      !line.categoryName ||
                                                      option.name
                                                        .toLocaleLowerCase()
                                                        .includes(
                                                          (
                                                            line.categoryName ??
                                                            ""
                                                          ).toLocaleLowerCase(),
                                                        ),
                                                  )
                                                  .map((option) => (
                                                    <button
                                                      key={option.id}
                                                      type="button"
                                                      onMouseDown={(event) =>
                                                        event.preventDefault()
                                                      }
                                                      onClick={() => {
                                                        setBillDraft(
                                                          (draft) => ({
                                                            ...draft,
                                                            lines:
                                                              draft.lines.map(
                                                                (
                                                                  current,
                                                                  currentIndex,
                                                                ) =>
                                                                  currentIndex ===
                                                                    index
                                                                    ? {
                                                                      ...current,
                                                                      categoryId:
                                                                        option.id,
                                                                      categoryName:
                                                                        option.name,
                                                                    }
                                                                    : current,
                                                              ),
                                                          }),
                                                        );
                                                        setCategoryOptionsOpen(
                                                          null,
                                                        );
                                                      }}
                                                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-sky-50"
                                                    >
                                                      <span className="truncate">
                                                        {option.name}
                                                      </span>
                                                      <span className="shrink-0 text-xs italic text-slate-500">
                                                        {option.accountSubType ||
                                                          option.accountType ||
                                                          "Account"}
                                                      </span>
                                                    </button>
                                                  ))}
                                              </div>,
                                              document.body,
                                            )
                                            : null}
                                          {!line.categoryId &&
                                            closestQuickBooksOption(
                                              line.categoryName ?? "",
                                              billOptions.accounts,
                                            ) ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const match =
                                                  closestQuickBooksOption(
                                                    line.categoryName ?? "",
                                                    billOptions.accounts,
                                                  )!;
                                                setBillDraft((draft) => ({
                                                  ...draft,
                                                  lines: draft.lines.map(
                                                    (current, currentIndex) =>
                                                      currentIndex === index
                                                        ? {
                                                          ...current,
                                                          categoryId:
                                                            match.id,
                                                          categoryName:
                                                            match.name,
                                                        }
                                                        : current,
                                                  ),
                                                }));
                                              }}
                                              className="mt-1 text-left text-xs text-sky-700 hover:underline"
                                            >
                                              Use closest match:{" "}
                                              {
                                                closestQuickBooksOption(
                                                  line.categoryName ?? "",
                                                  billOptions.accounts,
                                                )!.name
                                              }
                                            </button>
                                          ) : null}
                                        </td>
                                        <td className="px-3 py-2">
                                          <input
                                            value={line.description}
                                            onChange={(event) =>
                                              setBillDraft((draft) => ({
                                                ...draft,
                                                lines: draft.lines.map(
                                                  (current, currentIndex) =>
                                                    currentIndex === index
                                                      ? {
                                                        ...current,
                                                        description:
                                                          event.target.value,
                                                      }
                                                      : current,
                                                ),
                                              }))
                                            }
                                            className="w-full rounded border border-slate-300 px-3 py-2"
                                          />
                                        </td>
                                        <td className="px-3 py-2">
                                          <input
                                            required
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={line.amount}
                                            onChange={(event) =>
                                              setBillDraft((draft) => ({
                                                ...draft,
                                                lines: draft.lines.map(
                                                  (current, currentIndex) =>
                                                    currentIndex === index
                                                      ? {
                                                        ...current,
                                                        amount:
                                                          event.target.value,
                                                      }
                                                      : current,
                                                ),
                                              }))
                                            }
                                            className="w-full rounded border border-slate-300 px-3 py-2"
                                          />
                                        </td>
                                        <td className="px-3 py-2">
                                          <select
                                            required
                                            value={line.taxCodeId}
                                            onChange={(event) =>
                                              setBillDraft((draft) => ({
                                                ...draft,
                                                lines: draft.lines.map(
                                                  (current, currentIndex) =>
                                                    currentIndex === index
                                                      ? {
                                                        ...current,
                                                        taxCodeId:
                                                          event.target.value,
                                                      }
                                                      : current,
                                                ),
                                              }))
                                            }
                                            className="w-full rounded border border-slate-300 bg-white px-3 py-2"
                                          >
                                            <option value="">Choose GST</option>
                                            {selectableBillTaxCodes.map(
                                              (option) => (
                                                <option
                                                  key={option.id}
                                                  value={option.id}
                                                >
                                                  {option.name}
                                                </option>
                                              ),
                                            )}
                                          </select>
                                        </td>
                                        <td className="px-3 py-2">
                                          {billDraft.lines.length > 1 ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setBillDraft((draft) => ({
                                                  ...draft,
                                                  lines: draft.lines.filter(
                                                    (_, currentIndex) =>
                                                      currentIndex !== index,
                                                  ),
                                                }))
                                              }
                                              className="text-red-600 hover:underline"
                                            >
                                              Remove
                                            </button>
                                          ) : null}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="border-t border-slate-200 bg-slate-50">
                                    <tr>
                                      <td colSpan={6} className="px-3 py-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setBillDraft((draft) => ({
                                              ...draft,
                                              lines: [
                                                ...draft.lines,
                                                {
                                                  categoryId: "",
                                                  categoryName: "",
                                                  description: "",
                                                  amount: "",
                                                  taxCodeId: "",
                                                },
                                              ],
                                            }))
                                          }
                                          className="font-medium text-sky-700 hover:underline"
                                        >
                                          + Add expense line
                                        </button>
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                            <div className="ml-auto w-full max-w-sm rounded border border-slate-200 bg-slate-50 text-sm">
                              <div className="flex items-center justify-between gap-6 border-b border-slate-200 px-3 py-2">
                                <span className="font-medium text-slate-700">
                                  Expense Total
                                </span>
                                <span className="font-semibold tabular-nums text-slate-900">
                                  {billExpenseTotal.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-6 border-b border-slate-200 px-3 py-2">
                                <span className="font-medium text-slate-700">
                                  GST Amount
                                </span>
                                <span className="font-semibold tabular-nums text-slate-900">
                                  {(Number.parseFloat(billDraft.overallGstAmount) || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-6 px-3 py-2">
                                <span className="font-semibold text-slate-900">
                                  Grand Total
                                </span>
                                <span className="font-bold tabular-nums text-slate-900">
                                  {billGrandTotal.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <label className="block text-sm font-medium text-slate-700">
                              Overall GST Amount
                              <span className="mt-1 block text-xs font-normal text-slate-500">
                                Calculated from the expense-line amounts and
                                selected GST types. You may override it if needed.
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={billDraft.overallGstAmount}
                                onChange={(event) =>
                                  setBillDraft((draft) => ({
                                    ...draft,
                                    overallGstAmount: event.target.value,
                                  }))
                                }
                                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              Memo *
                              <textarea
                                required
                                value={billDraft.memo}
                                onChange={(event) =>
                                  setBillDraft((draft) => ({
                                    ...draft,
                                    memo: event.target.value,
                                  }))
                                }
                                className="mt-1 min-h-20 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                              />
                            </label>
                            <FileDropTarget
                              onFiles={(files) =>
                                setBillDraft((draft) => ({
                                  ...draft,
                                  attachments: [...draft.attachments, ...files],
                                }))
                              }
                            >
                              <label className="block text-sm font-medium text-slate-700">
                                Attachments
                              <span className="mt-1 block text-xs font-normal text-slate-500">
                                Click any attachment to preview it in the left
                                pane. Drag files or paste copied images here.
                                Files used for prefill are marked.
                              </span>
                              {editingQuickBooksBill &&
                                billTargetVoucher?.quickbooks_attachment_files
                                  ?.length ? (
                                <span className="mt-1 block text-xs font-normal text-slate-500">
                                  Existing QuickBooks attachments are retained.
                                  Add files here to attach more.
                                </span>
                              ) : null}
                              <input
                                type="file"
                                multiple
                                onChange={(event) =>
                                  setBillDraft((draft) => ({
                                    ...draft,
                                    attachments: [
                                      ...draft.attachments,
                                      ...Array.from(event.target.files ?? []),
                                    ],
                                  }))
                                }
                                className="mt-1 block w-full text-sm font-normal text-slate-600"
                              />
                              </label>
                            </FileDropTarget>
                            {billDraft.attachments.length ? (
                              <ul className="space-y-1 text-sm text-slate-600">
                                {billDraft.attachments.map((file, index) => (
                                  <li
                                    key={`${file.name}-${file.lastModified}-${index}`}
                                    className="flex items-center gap-2"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => previewAttachment(file)}
                                      className="min-w-0 truncate text-left text-sky-700 hover:underline"
                                    >
                                      {file.name}
                                    </button>
                                    {prefillFileSignature ===
                                      `${file.name}-${file.lastModified}` ? (
                                      <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
                                        Used for prefill
                                      </span>
                                    ) : null}
                                    <button
                                      type="button"
                                      aria-label={`Remove ${file.name}`}
                                      onClick={() =>
                                        setBillDraft((draft) => ({
                                          ...draft,
                                          attachments: draft.attachments.filter(
                                            (_, fileIndex) =>
                                              fileIndex !== index,
                                          ),
                                        }))
                                      }
                                      className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                                    >
                                      <X size={15} />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                      {!billTargetVoucher && !quickBooksBillOnlyMode ? (
                        <section className="order-1 border-t border-slate-200 pt-4">
                          <h3 className="font-semibold text-slate-800">
                            Voucher information
                          </h3>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="text-sm font-medium text-slate-700">
                              Cost *
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={voucherDraft.cost}
                                readOnly={otherBillChoice === "add"}
                                onChange={(event) =>
                                  setVoucherDraft((draft) => ({
                                    ...draft,
                                    cost: event.target.value,
                                  }))
                                }
                                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal read-only:bg-slate-100"
                              />
                              {otherBillChoice === "add" ? (
                                <span className="mt-1 block text-xs font-normal text-slate-500">
                                  Calculated from the expense-line amounts.
                                </span>
                              ) : null}
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                              Reason *
                              <div className="mt-1 h-10 overflow-hidden rounded border border-slate-300">
                                <StatusBadge
                                  value={voucherDraft.reason}
                                  onChange={(reason, option) =>
                                    setVoucherDraft((draft) => ({
                                      ...draft,
                                      reason,
                                      reasonOptionId: option?.id ?? "",
                                    }))
                                  }
                                  options={
                                    labelOptions.additional_cost_reason ?? []
                                  }
                                  onAddOption={(value) =>
                                    manageLabel(
                                      "additional_cost_reason",
                                      "add",
                                      value,
                                    )
                                  }
                                  onDeleteOption={(value, optionId) =>
                                    deleteLabel(
                                      "additional_cost_reason",
                                      value,
                                      optionId,
                                    )
                                  }
                                  onUpdateOptionColor={(value, color, optionId) =>
                                    manageLabel(
                                      "additional_cost_reason",
                                      "color",
                                      value,
                                      color,
                                      optionId,
                                    )
                                  }
                                  onRenameOption={(value, nextValue, optionId) =>
                                    manageLabel(
                                      "additional_cost_reason",
                                      "rename",
                                      value,
                                      nextValue,
                                      optionId,
                                    )
                                  }
                                  onReorderOptions={(layout) =>
                                    reorderLabels(
                                      "additional_cost_reason",
                                      layout,
                                    )
                                  }
                                  manageLabel="reason"
                                />
                              </div>
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                              Related Subitems *
                              {renderRelatedSubitemSelector(
                                selectedVoucherClientId!,
                              )}
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                              Order number
                              <input value={voucherDraft.orderNumber} onChange={(event) => setVoucherDraft((draft) => ({ ...draft, orderNumber: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                              Mode of payment
                              <div className="mt-1 h-10 overflow-hidden rounded border border-slate-300">
                                <StatusBadge value={voucherDraft.modeOfPayment} onChange={(value, option) => setVoucherDraft((draft) => ({ ...draft, modeOfPayment: value, modeOfPaymentOptionId: option?.id ?? "" }))} options={labelOptions.mode_of_payment ?? []} sectionCount={3} />
                              </div>
                            </label>
                          </div>
                          <label className="mt-3 block text-sm font-medium text-slate-700">
                            Remarks
                            {voucherReasonIsOther ? " * (Specify Reason)" : ""}
                            <textarea
                              value={voucherDraft.remarks}
                              onChange={(event) =>
                                setVoucherDraft((draft) => ({
                                  ...draft,
                                  remarks: event.target.value,
                                }))
                              }
                              className="mt-1 min-h-20 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            />
                          </label>
                        </section>
                      ) : null}
                      {voucherCreationGroup === "other" &&
                      !quickBooksBillOnlyMode &&
                      (!billTargetVoucher || Boolean(editingVoucher?.is_draft)) ? (
                        <button
                          type="button"
                          disabled={creatingFor !== null}
                          onClick={() => void savePaymentVoucherDraft(true)}
                          className="order-3 self-start rounded border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {creatingFor ? "Saving…" : "Save as draft"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={
                          creatingFor !== null ||
                          (otherBillChoice === "add" &&
                            (!billDraft.supplierName.trim() ||
                              !billDraft.billNumber.trim() ||
                              !billDraft.memo.trim() ||
                              billDraft.lines.some(
                                (line) =>
                                  !line.categoryId ||
                                  Number(line.amount) <= 0 ||
                                  !line.taxCodeId,
                              ))) ||
                          (!billTargetVoucher &&
                            !quickBooksBillOnlyMode &&
                            (Number(voucherDraft.cost) <= 0 ||
                              !voucherDraft.reason ||
                              !voucherDraft.relatedSubitemIds.length ||
                              (voucherReasonIsOther &&
                                !voucherDraft.remarks.trim())))
                        }
                        onClick={() =>
                          editingQuickBooksBill && billTargetVoucher
                            ? void updateQuickBooksBill(billTargetVoucher)
                            : quickBooksBillOnlyMode
                              ? void generateQuickBooksBillOnly(
                                billTargetVoucher,
                              )
                              : otherBillChoice === "add"
                                ? void generateQuickBooksBill(
                                  selectedVoucherClientId!,
                                  billTargetVoucher ??
                                    (editingVoucher?.is_draft
                                      ? editingVoucher
                                      : null),
                                )
                                : void create(selectedVoucherClientId!)
                        }
                        className="order-3 self-start rounded bg-[#16a5c4] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {creatingFor
                          ? editingQuickBooksBill
                            ? "Updating QuickBooks Bill…"
                            : otherBillChoice === "add"
                              ? "Creating QuickBooks Bill…"
                              : "Creating payment voucher…"
                          : editingQuickBooksBill
                            ? "Update QuickBooks Bill"
                            : otherBillChoice === "add"
                              ? billTargetVoucher
                                ? "Create and link QuickBooks Bill"
                                : "Create QuickBooks Bill and payment voucher"
                              : "Create payment voucher"}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  {!editingVoucher ? <button
                    type="button"
                    onClick={() => {
                      setSelectedVoucherClientId(null);
                      setBillDocumentPreview(null);
                      setPrefillFileSignature(null);
                    }}
                    className="text-sm text-sky-700 hover:underline"
                  >
                    Change project
                  </button> : null}
                  <p className="text-sm font-medium text-slate-700">
                    Project:{" "}
                    {editingVoucher
                      ? projectForVoucher(editingVoucher)?.label ?? "Linked client"
                      : clientLabel(clientsById.get(selectedVoucherClientId!)!)}
                  </p>
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-sm font-semibold text-slate-700">
                      Voucher information
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">
                      Cost *
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={voucherDraft.cost}
                        onChange={(event) =>
                          setVoucherDraft((draft) => ({
                            ...draft,
                            cost: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Reason *
                      <div className="mt-1 h-10 overflow-hidden rounded border border-slate-300">
                        <StatusBadge
                          value={voucherDraft.reason}
                          onChange={(reason, option) =>
                            setVoucherDraft((draft) => ({
                              ...draft,
                              reason,
                              reasonOptionId: option?.id ?? "",
                            }))
                          }
                          options={labelOptions.additional_cost_reason ?? []}
                          onAddOption={(value) =>
                            manageLabel("additional_cost_reason", "add", value)
                          }
                          onDeleteOption={(value, optionId) =>
                            deleteLabel("additional_cost_reason", value, optionId)
                          }
                          onUpdateOptionColor={(value, color, optionId) =>
                            manageLabel(
                              "additional_cost_reason",
                              "color",
                              value,
                              color,
                              optionId,
                            )
                          }
                          onRenameOption={(value, nextValue, optionId) =>
                            manageLabel(
                              "additional_cost_reason",
                              "rename",
                              value,
                              nextValue,
                              optionId,
                            )
                          }
                          onReorderOptions={(layout) =>
                            reorderLabels("additional_cost_reason", layout)
                          }
                          manageLabel="reason"
                        />
                      </div>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Related Subitems *
                      {renderRelatedSubitemSelector(selectedVoucherClientId!)}
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Courier
                      <div className="mt-1 h-10 overflow-hidden rounded border border-slate-300">
                        <StatusBadge
                          value={voucherDraft.courier}
                          onChange={(courier) =>
                            setVoucherDraft((draft) => ({
                              ...draft,
                              courier,
                            }))
                          }
                          options={labelOptions.additional_cost_courier ?? []}
                          onAddOption={(value) =>
                            manageLabel("additional_cost_courier", "add", value)
                          }
                          onDeleteOption={(value, optionId) =>
                            deleteLabel("additional_cost_courier", value, optionId)
                          }
                          onUpdateOptionColor={(value, color, optionId) =>
                            manageLabel(
                              "additional_cost_courier",
                              "color",
                              value,
                              color,
                              optionId,
                            )
                          }
                          onRenameOption={(value, nextValue, optionId) =>
                            manageLabel(
                              "additional_cost_courier",
                              "rename",
                              value,
                              nextValue,
                              optionId,
                            )
                          }
                          onReorderOptions={(layout) =>
                            reorderLabels("additional_cost_courier", layout)
                          }
                          manageLabel="courier"
                          sectionCount={1}
                        />
                      </div>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Order number
                      <input value={voucherDraft.orderNumber} onChange={(event) => setVoucherDraft((draft) => ({ ...draft, orderNumber: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Mode of payment
                      <div className="mt-1 h-10 overflow-hidden rounded border border-slate-300">
                        <StatusBadge value={voucherDraft.modeOfPayment} onChange={(value, option) => setVoucherDraft((draft) => ({ ...draft, modeOfPayment: value, modeOfPaymentOptionId: option?.id ?? "" }))} options={labelOptions.mode_of_payment ?? []} sectionCount={3} />
                      </div>
                    </label>
                  </div>
                  <label className="block text-sm font-medium text-slate-700">
                    Remarks{voucherReasonIsOther ? " * (Specify Reason)" : ""}{" "}
                    <textarea
                      value={voucherDraft.remarks}
                      onChange={(event) =>
                        setVoucherDraft((draft) => ({
                          ...draft,
                          remarks: event.target.value,
                        }))
                      }
                      className="mt-1 min-h-20 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      creatingFor !== null ||
                      Number(voucherDraft.cost) <= 0 ||
                      !voucherDraft.reason ||
                      (!editingVoucher && !voucherDraft.relatedSubitemIds.length) ||
                      (voucherReasonIsOther && !voucherDraft.remarks.trim())
                    }
                    onClick={() => editingVoucher ? void saveVoucherEdit() : void create(selectedVoucherClientId!)}
                    className="rounded bg-[#16a5c4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {creatingFor
                      ? editingVoucher ? "Saving…" : "Creating…"
                      : editingVoucher ? "Save payment voucher" : "Create payment voucher"}
                  </button>
                </div>
              )
            ) : (
              <>
                <label className="relative m-4 block">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    autoFocus
                    value={pickerQuery}
                    onChange={(event) => setPickerQuery(event.target.value)}
                    placeholder="Search client name or Client ID…"
                    className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500"
                  />
                </label>
                <div
                  ref={pickerScrollRef}
                  className="min-h-0 overflow-y-auto border-t border-slate-100 px-2 pb-2"
                >
                  {clientSections.map((section) => {
                    const expanded = expandedPickerGroups.has(section.id);
                    return (
                      <div key={section.id}>
                        <button
                          type="button"
                          onClick={(event) => {
                            const header = event.currentTarget;
                            const collapsing = expandedPickerGroups.has(
                              section.id,
                            );
                            setExpandedPickerGroups((current) => {
                              const next = new Set(current);
                              if (next.has(section.id)) next.delete(section.id);
                              else next.add(section.id);
                              return next;
                            });
                            if (collapsing) {
                              requestAnimationFrame(() =>
                                header.scrollIntoView({ block: "start" }),
                              );
                            }
                          }}
                          className="sticky top-0 z-10 flex w-full items-center justify-between border-y border-slate-100 bg-slate-50 px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-100"
                        >
                          <span>{section.label}</span>
                          {expanded ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </button>
                        {expanded
                          ? section.clients.map((client) => {
                            const restriction = creationRestriction(client);
                            const isLocked =
                              client.customFields?.subitemsLocked === "true";
                            return (
                              <div
                                key={client.id}
                                title={restriction ?? undefined}
                              >
                                <button
                                  disabled={
                                    creatingFor !== null ||
                                    Boolean(restriction)
                                  }
                                  onClick={() => {
                                    setSelectedVoucherClientId(client.id);
                                    setBillDraft((draft) => ({
                                      ...draft,
                                      memo: `${client.name || "Unnamed client"}${client.displayId ? ` · ${client.displayId}` : ""}`,
                                    }));
                                  }}
                                  className="flex w-full items-start rounded-md px-3 py-3 text-left text-sm hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center font-medium text-slate-700">
                                      {isLocked ? (
                                        <LockKeyhole
                                          size={17}
                                          aria-label="Locked client"
                                          className="mr-2 shrink-0 text-amber-500"
                                        />
                                      ) : null}
                                      <span className="truncate">
                                        {client.name || "Unnamed client"}
                                      </span>
                                      <span className="ml-2 shrink-0 font-mono text-xs text-slate-400">
                                        {client.displayId}
                                      </span>
                                    </span>
                                    <span className="mt-1 block truncate text-xs text-slate-500">
                                      Company: {client.company || "—"} ·
                                      Email: {client.email || "—"}
                                    </span>
                                    <span className="mt-1 block truncate text-xs text-slate-400">
                                      Subitems ({client.subitems.length}):{" "}
                                      {client.subitems.length
                                        ? client.subitems
                                          .slice(0, 3)
                                          .map(
                                            (subitem) =>
                                              subitem.name ||
                                              "Unnamed subitem",
                                          )
                                          .join(", ") +
                                        (client.subitems.length > 3
                                          ? "…"
                                          : "")
                                        : "None"}
                                    </span>
                                  </span>
                                  {creatingFor === client.id ? (
                                    <span className="ml-auto text-xs text-slate-400">
                                      Creating…
                                    </span>
                                  ) : null}
                                </button>
                              </div>
                            );
                          })
                          : null}
                      </div>
                    );
                  })}
                  {!clientSections.length ? (
                    <p className="px-3 py-8 text-center text-sm text-slate-400">
                      {pickerClientsLoading
                        ? "Loading clients…"
                        : "No matching clients."}
                    </p>
                  ) : null}
                  {pickerClientOffset < pickerClientTotal ? (
                    <div className="p-3 text-center">
                      <button
                        type="button"
                        disabled={pickerClientsLoadingMore}
                        onClick={() =>
                          void loadPickerClientPage(
                            pickerClientOffset,
                            true,
                            pickerQuery,
                          )
                        }
                        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {pickerClientsLoadingMore
                          ? "Loading…"
                          : `Load more (${pickerClients.length} of ${pickerClientTotal})`}
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
      <AlertDialog
        open={pendingDraftClose}
        onOpenChange={(open) => !open && setPendingDraftClose(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Payment Voucher as a draft?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(creatingFor)}>
              Keep editing
            </AlertDialogCancel>
            <button
              type="button"
              disabled={Boolean(creatingFor)}
              onClick={closePaymentVoucherPreview}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Discard
            </button>
            <AlertDialogAction
              disabled={Boolean(creatingFor)}
              onClick={(event) => {
                event.preventDefault();
                void savePaymentVoucherDraft(true);
              }}
            >
              {creatingFor ? "Saving…" : "Save as draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingExtractionFile)}
        onOpenChange={(open) => !open && setPendingExtractionFile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use this file for prefill?</AlertDialogTitle>
            <AlertDialogDescription>
              A document has already been used to prefill this Bill. Replacing
              it will use the new file for extraction and update the prefilled
              fields. Adding it as an attachment keeps the current prefill
              unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              onClick={() => {
                const file = pendingExtractionFile;
                setPendingExtractionFile(null);
                if (!file) return;
                setBillDraft((draft) =>
                  draft.attachments.some(
                    (attachment) =>
                      attachment.name === file.name &&
                      attachment.lastModified === file.lastModified,
                  )
                    ? draft
                    : { ...draft, attachments: [...draft.attachments, file] },
                );
                previewAttachment(file);
              }}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Add as attachment only
            </button>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                const file = pendingExtractionFile;
                setPendingExtractionFile(null);
                if (file) void extractBillDocument(file);
              }}
            >
              Replace and extract
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {activityVoucher && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={() => setActivityVoucher(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Payment Voucher Activity Log
                </h2>
                <p className="text-sm text-slate-500">
                  Reference ID: {activityVoucher.trip_id}
                </p>
              </div>
              <button type="button" onClick={() => setActivityVoucher(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5">
              {activityLoading ? <p className="text-sm text-slate-500">Loading activity history…</p> : !activityRows.length ? <p className="text-sm text-slate-500">No activity recorded yet.</p> : (
                <div className="space-y-3">{activityRows.map((entry) =>
                  <div key={entry.id} className="rounded-lg border p-3">
                    <div className="flex justify-between gap-4">
                      <p className="font-medium text-slate-800">{entry.title}</p>
                      <time className="whitespace-nowrap text-xs text-slate-400">{new Date(entry.created_at).toLocaleString("en-SG")}</time>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{entry.actor_name}</p>
                    {entry.meta?.reason && <p className="mt-2 text-sm text-slate-700">Reason: {entry.meta.reason}</p>}{entry.field_name && <p className="mt-2 break-words text-sm text-slate-600">{JSON.stringify(entry.old_value)} → {JSON.stringify(entry.new_value)}
                    </p>}
                  </div>)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeactivationReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Payment Voucher?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.voucher_group === "quickbooks_bills_only" ? (
                `This removes only this row from the Payment Voucher board. The QuickBooks Bill${pendingDelete.quickbooks_invoice_number ? ` (${pendingDelete.quickbooks_invoice_number})` : ""} will not be deleted or changed in QuickBooks. Manage it directly in QuickBooks if needed. This action cannot be undone.`
              ) : (
                <>
                  This payment voucher and its linked CRM subitem will both be
                  deleted. This action cannot be undone.
                  {pendingDelete &&
                    !/lalamove|easyparcel/i.test(pendingDelete.courier)
                    ? ` The QuickBooks Bill${pendingDelete.quickbooks_invoice_number ? ` (${pendingDelete.quickbooks_invoice_number})` : ""} is not deleted automatically; handle it directly in QuickBooks.`
                    : ""}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Deactivation Reason <span className="text-red-500">*</span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border p-3 font-normal"
              value={deactivationReason}
              onChange={(event) => setDeactivationReason(event.target.value)}
              placeholder="Explain why this voucher is being deactivated"
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(deletingId) || !deactivationReason.trim()}
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) void remove(pendingDelete);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingId ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingQuickBooksBillClear)}
        onOpenChange={(open) => !open && setPendingQuickBooksBillClear(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove QuickBooks Bill details?</AlertDialogTitle>
            <AlertDialogDescription>
              Setting Has QuickBooks Bill? to No will permanently clear this
              payment voucher’s Invoice No., Supplier, and Attached Files
              values. The Bill in QuickBooks itself will not be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (pendingQuickBooksBillClear) {
                  void update(pendingQuickBooksBillClear.id, {
                    has_quickbooks_bill: false,
                    quickbooks_invoice_number: "",
                    quickbooks_supplier_id: "",
                    quickbooks_supplier_name: "",
                    quickbooks_overall_gst_override: null,
                    quickbooks_attachment_files: [],
                  });
                }
                setPendingQuickBooksBillClear(null);
              }}
            >
              Set to No and clear values
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingBillErrorResolution)}
        onOpenChange={(open) => !open && setPendingBillErrorResolution(null)}
      >
        <AlertDialogContent className="sm:max-w-4xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve missing QuickBooks Bill</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingBillErrorResolution?.voucher_group ===
                "quickbooks_bills_only"
                ? "QuickBooks could not find this Bill. Choose whether to remove this Bill-only row or recreate the Bill."
                : "QuickBooks could not find the Bill linked to this payment voucher. Choose how to resolve the broken link."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            className={`grid gap-3 ${pendingBillErrorResolution?.voucher_group === "quickbooks_bills_only" ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
          >
            <button
              type="button"
              onClick={() => {
                const voucher = pendingBillErrorResolution;
                setPendingBillErrorResolution(null);
                if (voucher) {
                  if (voucher.voucher_group === "quickbooks_bills_only")
                    setPendingDelete(voucher);
                  else void removeBrokenBillLink(voucher);
                }
              }}
              className="min-h-32 rounded-md bg-red-600 px-5 py-4 text-left text-base font-semibold text-white hover:bg-red-700"
            >
              {pendingBillErrorResolution?.voucher_group ===
                "quickbooks_bills_only"
                ? "Remove Bill and this row"
                : "Remove Bill and its existing information"}
              <span className="mt-1 block text-xs font-normal text-red-100">
                {pendingBillErrorResolution?.voucher_group ===
                  "quickbooks_bills_only"
                  ? "This removes the Bill-only payment-voucher row from the board."
                  : "Keep the payment voucher, but return it to the no-Bill state."}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                const voucher = pendingBillErrorResolution;
                setPendingBillErrorResolution(null);
                if (voucher) openAddBill(voucher, true);
              }}
              className="min-h-32 rounded-md bg-sky-600 px-5 py-4 text-left text-base font-semibold text-white hover:bg-sky-700"
            >
              Create new Bill
              <span className="mt-1 block text-xs font-normal text-sky-100">
                Open a new Bill draft prefilled with the remaining voucher
                information.
              </span>
            </button>
            {pendingBillErrorResolution?.voucher_group !==
              "quickbooks_bills_only" ? (
              <button
                type="button"
                onClick={() => {
                  const voucher = pendingBillErrorResolution;
                  setPendingBillErrorResolution(null);
                  if (voucher) {
                    setBillLinkVoucher(voucher);
                    setBillLinkMode("lookup");
                    setBillLinkNumber("");
                    setBillLinkResults([]);
                    setBillLinkSearched(false);
                  }
                }}
                className="min-h-32 rounded-md bg-violet-600 px-5 py-4 text-left text-base font-semibold text-white hover:bg-violet-700"
              >
                Link existing QuickBooks Bill
                <span className="mt-1 block text-xs font-normal text-violet-100">
                  Find and link a replacement Bill by its invoice number.
                </span>
              </button>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(billLinkVoucher)}
        onOpenChange={(open) => {
          if (!open) {
            setBillLinkVoucher(null);
            setBillLinkResults([]);
            setBillLinkNumber("");
            setBillLinkSearched(false);
            setBillLinkMode("choice");
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Link a QuickBooks Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Choose a new Bill, or find an existing QuickBooks Bill by its
              invoice number.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {billLinkMode === "choice" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  const voucher = billLinkVoucher;
                  if (voucher) {
                    setBillLinkVoucher(null);
                    openAddBill(voucher);
                  }
                }}
                className="min-h-36 rounded-md bg-sky-600 px-6 py-5 text-left text-lg font-semibold text-white hover:bg-sky-700"
              >
                Create a new QuickBooks Bill
                <span className="mt-2 block text-sm font-normal text-sky-100">
                  Prepare a new Bill using this payment voucher.
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setBillLinkMode("lookup");
                  setBillLinkNumber("");
                  setBillLinkResults([]);
                  setBillLinkSearched(false);
                }}
                className="min-h-36 rounded-md bg-violet-600 px-6 py-5 text-left text-lg font-semibold text-white hover:bg-violet-700"
              >
                Link an existing QuickBooks Bill
                <span className="mt-2 block text-sm font-normal text-violet-100">
                  Search by an existing Bill / invoice number.
                </span>
              </button>
            </div>
          ) : !billLinkSearched ? (
            <div className="rounded-md border border-slate-200 p-4">
              <label className="block text-sm font-medium text-slate-700">
                Existing Bill / invoice number on QuickBooks
                <input
                  value={billLinkNumber}
                  onChange={(event) => setBillLinkNumber(event.target.value)}
                  onKeyDown={(event) =>
                    event.key === "Enter" && void lookupExistingBill()
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  placeholder="Enter Bill number"
                />
              </label>
              <button
                type="button"
                disabled={billLinkLoading || !billLinkNumber.trim()}
                onClick={() => void lookupExistingBill()}
                className="mt-3 rounded bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
              >
                {billLinkLoading ? "Searching…" : "Find existing Bill"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setBillLinkResults([]);
                  setBillLinkSearched(false);
                }}
                className="text-sm text-sky-700 hover:underline"
              >
                Search again
              </button>
              {!billLinkResults.length ? (
                <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  No QuickBooks Bills were found with invoice number “
                  {billLinkNumber}”. Check the number and try again.
                </div>
              ) : (
                billLinkResults.map((bill) => (
                  <div
                    key={bill.id}
                    className="rounded border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          Bill {bill.billNumber || bill.id}
                        </p>
                        <p className="text-sm text-slate-600">
                          {bill.supplierName || "No supplier"} · $
                          {bill.total.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Bill date: {bill.billDate || "—"} · Due:{" "}
                          {bill.dueDate || "—"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={bill.alreadyLinked || billLinkLoading}
                        onClick={() => void linkExistingBill(bill.id)}
                        className="rounded bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                      >
                        {bill.alreadyLinked
                          ? `Already linked${bill.linkedVoucherReference ? ` (${bill.linkedVoucherReference})` : ""}`
                          : "Link this Bill"}
                      </button>
                    </div>
                    {bill.alreadyLinked && (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        This Bill is already linked to another payment voucher
                        and cannot be selected.
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

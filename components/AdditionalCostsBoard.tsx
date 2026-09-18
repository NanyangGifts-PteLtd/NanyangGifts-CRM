"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LockKeyhole,
  LoaderCircle,
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
import { AssigneeMultiSelect } from "@/components/ui/assignee-multiselect";
import {
  StatusBadge,
  type BadgeOptionLayout,
} from "@/components/ui/statusbadge";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

type AdditionalCost = {
  id: string;
  client_id: string;
  date_sent: string | null;
  people_id: string | null;
  people_ids?: string[];
  cost: number | null;
  remarks: string;
  status: string;
  reason: string;
  courier: string;
  trip_id: string;
  items_sent: string;
  qty: string;
  verified: boolean | null;
  discussed: boolean | null;
  created_at: string;
  created_by?: string | null;
  has_quickbooks_bill?: boolean;
  quickbooks_invoice_number?: string;
  quickbooks_supplier_id?: string;
  quickbooks_supplier_name?: string;
  quickbooks_bill_id?: string | null;
  quickbooks_attachment_files?: Array<{ name?: string; id?: string; contentType?: string }>;
};
type LabelOption = {
  id?: string;
  value: string;
  color: string;
  section?: number;
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
  { key: "project", label: "Project Name", width: 250 },
  { key: "cost", label: "Cost", width: 115 },
  { key: "reason", label: "Reason", width: 155 },
  { key: "remarks", label: "Remarks", width: 260 },
  { key: "trip_id", label: "Reference ID", width: 145 },
  { key: "items_sent", label: "Related Subitems", width: 210 },
  { key: "courier", label: "Courier", width: 140 },
  { key: "created", label: "Date Created", width: 140 },
  { key: "actions", label: "", width: 52 },
];
const otherVoucherColumns: Column[] = [
  { key: "project", label: "Project Name", width: 250 },
  { key: "cost", label: "Cost", width: 115 },
  { key: "reason", label: "Reason", width: 155 },
  { key: "remarks", label: "Remarks", width: 260 },
  { key: "trip_id", label: "Reference ID", width: 145 },
  { key: "items_sent", label: "Related Subitems", width: 210 },
  { key: "has_quickbooks_bill", label: "Has QuickBooks Bill?", width: 165 },
  { key: "quickbooks_invoice_number", label: "Invoice No. (Bill No.)", width: 185 },
  { key: "quickbooks_supplier_name", label: "Supplier", width: 220 },
  { key: "quickbooks_attachment_files", label: "Attached Files", width: 240 },
  { key: "created", label: "Date Created", width: 140 },
  { key: "actions", label: "", width: 52 },
];
const cellClass =
  "h-10 min-w-0 bg-white px-2 text-sm text-slate-700 outline-none focus:bg-sky-50 focus:ring-1 focus:ring-inset focus:ring-sky-400";
const clientLabel = (client: Client) =>
  `${client.name || "Unnamed client"}${client.displayId ? ` · ${client.displayId}` : ""}`;
// Keep chooser order consistent with the CRM Board's default client sort:
// newest created clients first within each group.
const compareByDefaultClientBoardOrder = (first: Client, second: Client) =>
  new Date(second.createdAt || 0).getTime() -
  new Date(first.createdAt || 0).getTime();
const supplierSearchKey = (value: string) =>
  value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
const levenshteinDistance = (first: string, second: string) => {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
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
  const [collapsedVoucherGroups, setCollapsedVoucherGroups] = useState({
    courier: false,
    other: false,
  });
  const [labelOptions, setLabelOptions] = useState<
    Record<string, LabelOption[]>
  >({});
  const [columns, setColumns] = useState(initialColumns);
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
  const [expandedPickerGroups, setExpandedPickerGroups] = useState<Set<string>>(
    new Set(),
  );
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [selectedVoucherClientId, setSelectedVoucherClientId] = useState<
    string | null
  >(null);
  const [voucherCreationGroup, setVoucherCreationGroup] = useState<
    "courier" | "other"
  >("courier");
  const [otherBillChoice, setOtherBillChoice] = useState<
    "add" | "none" | null
  >(null);
  const [billOptions, setBillOptions] = useState<{
    vendors: Array<{ id: string; name: string }>;
    accounts: Array<{ id: string; name: string }>;
    terms: Array<{ id: string; name: string }>;
    taxCodes: Array<{ id: string; name: string; rate?: number }>;
  }>({ vendors: [], accounts: [], terms: [], taxCodes: [] });
  const [billOptionsLoading, setBillOptionsLoading] = useState(false);
  const [billOptionsError, setBillOptionsError] = useState<string | null>(null);
  const [extractingBillDocument, setExtractingBillDocument] = useState(false);
  const [billDocumentPreview, setBillDocumentPreview] = useState<{
    name: string;
    type: string;
    url: string;
    confidence: Record<string, number>;
    supplierSuggestion?: { id: string; name: string };
    isPrefill: boolean;
  } | null>(null);
  const [pendingExtractionFile, setPendingExtractionFile] = useState<File | null>(null);
  const [prefillFileSignature, setPrefillFileSignature] = useState<string | null>(null);
  const [billDraft, setBillDraft] = useState({
    supplierId: "",
    mailingAddress: "",
    termId: "",
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    billNumber: "",
    memo: "",
    attachments: [] as File[],
    lines: [{ categoryId: "", description: "", amount: "", taxCodeId: "" }],
  });
  const [voucherDraft, setVoucherDraft] = useState({
    cost: "",
    reason: "",
    relatedSubitemIds: [] as string[],
    courier: "",
    remarks: "",
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
  useEffect(() => {
    return () => {
      if (billDocumentPreview?.url) URL.revokeObjectURL(billDocumentPreview.url);
    };
  }, [billDocumentPreview?.url]);
  useEffect(() => {
    if (pickerOpen && selectedVoucherClientId) return;
    setBillDocumentPreview(null);
    setPrefillFileSignature(null);
    setPendingExtractionFile(null);
  }, [pickerOpen, selectedVoucherClientId]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdditionalCost | null>(
    null,
  );
  const [pendingQuickBooksBillClear, setPendingQuickBooksBillClear] =
    useState<AdditionalCost | null>(null);
  const rowRevisions = useRef(new Map<string, number>());
  const gridTemplateColumns = columns
    .map((column) => `${column.width}px`)
    .join(" ");
  const clientsById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );
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
      const { data: { session } } = await supabase.auth.getSession();
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
      });
    }
    setLabelOptions(next);
  }, []);
  useEffect(() => {
    void loadLabelOptions();
  }, [loadLabelOptions]);
  // The group-two table can be edited without opening the creation dialog,
  // so its QuickBooks supplier selector needs its options up front.
  useEffect(() => {
    let active = true;
    void fetch("/api/quickbooks/vendors")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (active && response.ok)
          setBillOptions((current) => ({ ...current, vendors: data.vendors ?? [] }));
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
    if (!pickerOpen || voucherCreationGroup !== "other" || otherBillChoice !== "add")
      return;
    let active = true;
    setBillOptionsLoading(true);
    setBillOptionsError(null);
    void Promise.all([
      fetch("/api/quickbooks/vendors").then((response) => response.json().then((data) => ({ response, data }))),
      fetch("/api/quickbooks/expense-accounts").then((response) => response.json().then((data) => ({ response, data }))),
      fetch("/api/quickbooks/terms").then((response) => response.json().then((data) => ({ response, data }))),
      fetch("/api/quickbooks/tax-codes").then((response) => response.json().then((data) => ({ response, data }))),
    ])
      .then(([vendors, accounts, terms, taxCodes]) => {
        if (!active) return;
        const failed = [vendors, accounts, terms, taxCodes].find(({ response }) => !response.ok);
        if (failed) throw new Error(failed.data?.error ?? "Could not load QuickBooks Bill options.");
        setBillOptions({
          vendors: vendors.data.vendors ?? [],
          accounts: accounts.data.accounts ?? [],
          terms: terms.data.terms ?? [],
          taxCodes: taxCodes.data.taxCodes ?? [],
        });
      })
      .catch((loadError) => {
        if (active) setBillOptionsError(loadError instanceof Error ? loadError.message : "Could not load QuickBooks Bill options.");
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
  const manageLabel = async (
    code: string,
    action: "add" | "color" | "rename",
    value: string,
    extra?: string,
  ) => {
    const response = await fetch("/api/additional-costs/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "add"
          ? { code, action, value }
          : action === "color"
            ? { code, action, value, color: extra }
            : { code, action, value, nextValue: extra },
      ),
    });
    const result = await response.json();
    if (!response.ok) {
      toast.error("Label could not be updated", { description: result.error });
      return;
    }
    await loadLabelOptions();
  };
  const deleteLabel = async (code: string, value: string) => {
    const response = await fetch("/api/options/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", code, name: value }),
    });
    const result = await response.json();
    if (!response.ok) {
      toast.error("Label could not be deleted", { description: result.error });
      return;
    }
    setRows((current) =>
      current.map((row) =>
        code === "additional_cost_status" && row.status === value
          ? { ...row, status: "" }
          : code === "additional_cost_reason" && row.reason === value
            ? { ...row, reason: "" }
            : code === "additional_cost_courier" && row.courier === value
              ? { ...row, courier: "" }
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
  const resize = (index: number, startX: number, startWidth: number) => {
    const onMove = (event: PointerEvent) =>
      setColumns((current) =>
        current.map((column, columnIndex) =>
          columnIndex === index
            ? {
                ...column,
                width: Math.max(72, startWidth + event.clientX - startX),
              }
            : column,
        ),
      );
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const update = useCallback(
    async (id: string, values: Record<string, unknown>) => {
      const previous = rows.find((row) => row.id === id);
      if (!previous) return;
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
        body: JSON.stringify({ clientId, values: voucherDraft }),
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
        relatedSubitemIds: [],
        courier: "",
        remarks: "",
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
  const generateQuickBooksBill = async (clientId: string) => {
    setCreatingFor(clientId);
    try {
      const { attachments: _attachments, ...billDraftValues } = billDraft;
      const selectedSupplier = billOptions.vendors.find(
        (vendor) => vendor.id === billDraft.supplierId,
      );
      const bill = {
        ...billDraftValues,
        supplierName: selectedSupplier?.name ?? "",
      };
      const payload = new FormData();
      payload.append("payload", JSON.stringify({ clientId, voucher: voucherDraft, bill }));
      billDraft.attachments.forEach((attachment) =>
        payload.append("attachments", attachment, attachment.name),
      );
      const response = await fetch("/api/quickbooks/generate-bill", {
        method: "POST",
        body: payload,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not generate the QuickBooks Bill.");
      setRows((current) => [result.row, ...current]);
      setPickerOpen(false);
      setSelectedVoucherClientId(null);
      setOtherBillChoice(null);
      setBillDocumentPreview(null);
      setPrefillFileSignature(null);
      toast.success(`QuickBooks Bill ${result.docNumber ?? ""} and payment voucher created.`);
      if (result.attachmentErrors?.length)
        toast.warning("The Bill was created, but some attachments could not be uploaded.", {
          description: result.attachmentErrors.map((error: string) => error.split(":")[0]).join(", "),
        });
    } catch (generationError) {
      toast.error("QuickBooks Bill could not be generated", {
        description: generationError instanceof Error ? generationError.message : "Please try again.",
      });
    } finally {
      setCreatingFor(null);
    }
  };
  const extractBillDocument = async (file: File) => {
    if (!selectedVoucherClientId) return;
    const previewUrl = URL.createObjectURL(file);
    setPrefillFileSignature(`${file.name}-${file.lastModified}`);
    setBillDocumentPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return { name: file.name, type: file.type, url: previewUrl, confidence: {}, isPrefill: true };
    });
    setBillDraft((draft) =>
      draft.attachments.some((attachment) =>
        attachment.name === file.name && attachment.lastModified === file.lastModified,
      )
        ? draft
        : { ...draft, attachments: [...draft.attachments, file] },
    );
    setExtractingBillDocument(true);
    try {
      const payload = new FormData();
      payload.append("file", file, file.name);
      payload.append("clientId", selectedVoucherClientId);
      const response = await fetch("/api/quickbooks/extract-bill-document", {
        method: "POST",
        body: payload,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not extract this document.");
      const extraction = result.extraction as {
        supplierName?: string;
        mailingAddress?: string;
        invoiceNumber?: string;
        billDate?: string;
        dueDate?: string;
        confidence?: Record<string, number>;
        lines?: Array<{ description?: string; amount?: number | null; tax?: string }>;
      };
      const normalise = (value: string) => value.trim().toLocaleLowerCase();
      const extractedSupplier = supplierSearchKey(extraction.supplierName ?? "");
      const suppliersByCloseness = billOptions.vendors
        .map((option) => ({
          ...option,
          score: extractedSupplier
            ? levenshteinDistance(supplierSearchKey(option.name), extractedSupplier) /
              Math.max(supplierSearchKey(option.name).length, extractedSupplier.length, 1)
            : Number.POSITIVE_INFINITY,
        }))
        .sort((first, second) => first.score - second.score);
      const supplier = suppliersByCloseness[0];
      const exactSupplier = supplier?.score === 0 ? supplier : undefined;
      const findTaxCode = (tax: string) => {
        const query = normalise(tax);
        if (!query) return "";
        return billOptions.taxCodes.find((option) => normalise(option.name).includes(query) || query.includes(normalise(option.name)))?.id ?? "";
      };
      setBillDraft((draft) => ({
        ...draft,
        supplierId: exactSupplier?.id ?? draft.supplierId,
        mailingAddress: extraction.mailingAddress || draft.mailingAddress,
        billDate: extraction.billDate || draft.billDate,
        dueDate: extraction.dueDate || draft.dueDate,
        billNumber: extraction.invoiceNumber || draft.billNumber,
        lines: extraction.lines?.length
          ? extraction.lines.map((line) => ({
              categoryId: "",
              description: line.description ?? "",
              amount: line.amount ? String(line.amount) : "",
              taxCodeId: findTaxCode(line.tax ?? ""),
            }))
          : draft.lines,
      }));
      setBillDocumentPreview((current) => current ? {
        ...current,
        confidence: extraction.confidence ?? {},
        supplierSuggestion: supplier && extractedSupplier
          ? { id: supplier.id, name: supplier.name }
          : undefined,
      } : current);
      toast.success("Document fields were prefilled. Please review every value before creating the Bill.");
    } catch (extractionError) {
      toast.error("Document could not be read", {
        description: extractionError instanceof Error ? extractionError.message : "Please enter the Bill details manually.",
      });
    } finally {
      setExtractingBillDocument(false);
    }
  };
  const previewAttachment = (file: File) => {
    const url = URL.createObjectURL(file);
    setBillDocumentPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      const isPrefill = prefillFileSignature === `${file.name}-${file.lastModified}`;
      return { name: file.name, type: file.type, url, confidence: {}, isPrefill };
    });
  };
  const canDelete = (row: AdditionalCost) => {
    const role = String(currentUserRole ?? "").toLowerCase();
    return (
      ["admin", "director"].includes(role) ||
      (!!currentUserId &&
        ((clientAssignees[row.client_id] ?? []).includes(currentUserId) ||
          (clientPmAssignees[row.client_id] ?? []).includes(currentUserId)))
    );
  };
  const creationRestriction = (client: Client) => {
    if (client.customFields?.subitemsLocked === "true") {
      return "This client is locked. Unlock its subitems on the CRM Board before adding an additional cost.";
    }
    const role = String(currentUserRole ?? "").toLowerCase();
    const isAssigned =
      !!currentUserId &&
      ((clientAssignees[client.id] ?? []).includes(currentUserId) ||
        (clientPmAssignees[client.id] ?? []).includes(currentUserId));
    if (!["admin", "director"].includes(role) && !isAssigned) {
      return "You can only link an additional cost to a client assigned to you as People or PM.";
    }
    return null;
  };
  const remove = async (row: AdditionalCost) => {
    setDeletingId(row.id);
    try {
      const response = await fetch(
        `/api/additional-costs?id=${encodeURIComponent(row.id)}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Could not delete the additional cost.",
        );
      setRows((current) =>
        current.filter((candidate) => candidate.id !== row.id),
      );
      setPendingDelete(null);
      toast.success("Additional cost deleted");
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
  const filteredClients = clients.filter((client) =>
    clientLabel(client)
      .toLowerCase()
      .includes(pickerQuery.trim().toLowerCase()),
  );
  const clientSections = useMemo(() => {
    const sections = [...groups]
      .sort((first, second) => first.sort_order - second.sort_order)
      .map((group) => ({
        id: group.id,
        label: group.name,
        clients: filteredClients
          .filter((client) => client.groupId === group.id)
          .sort(compareByDefaultClientBoardOrder),
      }))
      .filter((section) => section.clients.length);
    const ungrouped = filteredClients
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
  }, [filteredClients, groups]);
  const renderRelatedSubitemSelector = (clientId: string) => {
    const subitems = (clientsById.get(clientId)?.subitems ?? []).filter(
      (subitem) => !subitem.customFields?.additionalCostId,
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
              <label key={subitem.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={voucherDraft.relatedSubitemIds.includes(subitem.id)}
                  onChange={() =>
                    setVoucherDraft((draft) => ({
                      ...draft,
                      relatedSubitemIds: draft.relatedSubitemIds.includes(subitem.id)
                        ? draft.relatedSubitemIds.filter((id) => id !== subitem.id)
                        : [...draft.relatedSubitemIds, subitem.id],
                    }))
                  }
                />
                <span className="min-w-0 truncate">{subitem.name || "Unnamed subitem"}</span>
                <span className="shrink-0 font-mono text-xs text-slate-400">{subitem.displayId}</span>
              </label>
            ))
          ) : (
            <p className="px-2 py-3 text-sm text-slate-500">This client has no subitems.</p>
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
      (subitem) => !subitem.customFields?.additionalCostId,
    );
    const selectedNames = new Set(
      row.items_sent.split(",").map((name) => name.trim()).filter(Boolean),
    );
    const selectedIds = subitems
      .filter((subitem) => selectedNames.has(subitem.name))
      .map((subitem) => subitem.id);
    const menuOpen = boardRelatedSubitemsMenu?.rowId === row.id;
    return (
      <>
        <button
          type="button"
          data-related-subitems-trigger
          disabled={!canDelete(row)}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setBoardRelatedSubitemsMenu(
              menuOpen
                ? null
                : { rowId: row.id, top: rect.bottom + 4, left: rect.left, width: rect.width },
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
            <label key={subitem.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-slate-50">
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
              <span className="min-w-0 truncate">{subitem.name || "Unnamed subitem"}</span>
              <span className="shrink-0 font-mono text-xs text-slate-400">{subitem.displayId}</span>
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
      name: "Lalamove/Easyparcel",
      rows: rows.filter((row) => /lalamove|easyparcel/i.test(row.courier)),
      accent: "#16a5c4",
    },
    {
      id: "other" as const,
      name: "Manpower/UPS Charges/Other payments",
      rows: rows.filter((row) => !/lalamove|easyparcel/i.test(row.courier)),
      accent: "#8b5cf6",
    },
  ];
  const renderVoucherGroup = (group: (typeof voucherGroups)[number]) => {
    const tableColumns = group.id === "courier" ? initialColumns : otherVoucherColumns;
    return (
    <section
      key={group.id}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <button
        type="button"
        onClick={() =>
          setCollapsedVoucherGroups((current) => ({
            ...current,
            [group.id]: !current[group.id],
          }))
        }
        className="flex w-full items-center gap-2 border-l-4 px-4 py-3 text-left hover:bg-slate-50"
        style={{ borderLeftColor: group.accent }}
      >
        {collapsedVoucherGroups[group.id] ? (
          <ChevronRight size={18} style={{ color: group.accent }} />
        ) : (
          <ChevronDown size={18} style={{ color: group.accent }} />
        )}
        <span className="text-lg font-semibold text-slate-800">
          {group.name}
        </span>
        <span className="text-sm text-slate-500">
          {group.rows.length} vouchers
        </span>
      </button>
      {!collapsedVoucherGroups[group.id] && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                {tableColumns.map((column) => (
                  <th
                    key={column.key}
                    className="whitespace-nowrap border-b border-r border-slate-200 px-3 py-3 last:border-r-0"
                  >
                    {column.label}
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
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="border-b border-r border-slate-200 px-3 py-2 font-medium text-slate-700">
                        {client ? (
                          <button
                            type="button"
                            onClick={() => onOpenProject?.(client.id)}
                            className="max-w-full truncate text-left text-sky-700 hover:underline"
                            title={`Open ${clientLabel(client)} on the CRM Board`}
                          >
                            {clientLabel(client)}
                          </button>
                        ) : (
                          "Deleted client"
                        )}
                      </td>
                      <td className="border-b border-r border-slate-200 p-0">
                        <input
                          key={`${row.id}-cost-${row.cost ?? ""}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          defaultValue={row.cost ?? ""}
                          disabled={!canDelete(row)}
                          onBlur={(event) =>
                            event.target.value !== String(row.cost ?? "") &&
                            void update(row.id, { cost: event.target.value })
                          }
                          className="h-10 w-full bg-transparent px-3 text-right outline-none focus:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                      <td className="h-10 border-b border-r border-slate-200 p-0">
                        <StatusBadge
                          value={row.reason}
                          onChange={(reason) => {
                            if (
                              reason.trim().toLocaleLowerCase() === "other" &&
                              !row.remarks.trim()
                            ) {
                              toast.error("Remarks is required when Reason is Other.");
                              return;
                            }
                            void update(row.id, { reason });
                          }}
                          options={labelOptions.additional_cost_reason ?? []}
                          onAddOption={(value) =>
                            manageLabel("additional_cost_reason", "add", value)
                          }
                          onDeleteOption={(value) =>
                            deleteLabel("additional_cost_reason", value)
                          }
                          onUpdateOptionColor={(value, color) =>
                            manageLabel(
                              "additional_cost_reason",
                              "color",
                              value,
                              color,
                            )
                          }
                          onRenameOption={(value, nextValue) =>
                            manageLabel(
                              "additional_cost_reason",
                              "rename",
                              value,
                              nextValue,
                            )
                          }
                          onReorderOptions={(layout) =>
                            reorderLabels("additional_cost_reason", layout)
                          }
                          manageLabel="reason"
                          readOnly={!canDelete(row)}
                        />
                      </td>
                      <td className="border-b border-r border-slate-200 p-0">
                        <input
                          key={`${row.id}-remarks-${row.remarks}`}
                          defaultValue={row.remarks}
                          disabled={!canDelete(row)}
                          onBlur={(event) => event.target.value !== row.remarks && void update(row.id, { remarks: event.target.value })}
                          className="h-10 w-full bg-transparent px-3 outline-none focus:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                      <td className="border-b border-r border-slate-200 px-3 py-2">{row.trip_id}</td>
                      <td className="border-b border-r border-slate-200 p-0">{renderBoardRelatedSubitemSelector(row, client)}</td>
                      {group.id === "courier" ? <td className="h-10 border-b border-r border-slate-200 p-0">
                        <StatusBadge
                          value={row.courier}
                          onChange={(courier) => void update(row.id, { courier })}
                          options={(labelOptions.additional_cost_courier ?? []).filter((option) => ["Lalamove", "Easyparcel"].includes(option.value))}
                          includeBlankOption={false}
                          readOnly={!canDelete(row)}
                        />
                      </td> : <>
                        <td className="h-10 border-b border-r border-slate-200 p-0">
                          <StatusBadge
                            value={row.has_quickbooks_bill ? "Yes" : "No"}
                            onChange={(value) => {
                              if (value === "Yes") {
                                void update(row.id, { has_quickbooks_bill: true });
                              } else if (row.has_quickbooks_bill) {
                                setPendingQuickBooksBillClear(row);
                              }
                            }}
                            options={[
                              { value: "Yes", color: "#16a34a" },
                              { value: "No", color: "#94a3b8" },
                            ]}
                            includeBlankOption={false}
                            readOnly={!canDelete(row)}
                          />
                        </td>
                        <td className="border-b border-r border-slate-200 p-0">
                          <input
                            key={`${row.id}-invoice-${row.quickbooks_invoice_number ?? ""}-${row.has_quickbooks_bill}`}
                            defaultValue={row.quickbooks_invoice_number ?? ""}
                            disabled={!canDelete(row) || !row.has_quickbooks_bill}
                            onBlur={(event) => event.target.value !== (row.quickbooks_invoice_number ?? "") && void update(row.id, { quickbooks_invoice_number: event.target.value })}
                            className="h-10 w-full bg-transparent px-3 outline-none focus:bg-sky-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="border-b border-r border-slate-200 p-0">
                          <select
                            value={row.quickbooks_supplier_id ?? ""}
                            disabled={!canDelete(row) || !row.has_quickbooks_bill}
                            onChange={(event) => {
                              const supplier = billOptions.vendors.find((vendor) => vendor.id === event.target.value);
                              void update(row.id, { quickbooks_supplier_id: event.target.value, quickbooks_supplier_name: supplier?.name ?? "" });
                            }}
                            className="h-10 w-full bg-transparent px-3 outline-none focus:bg-sky-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="">Choose a supplier</option>
                            {billOptions.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                          </select>
                        </td>
                        <td className={`border-b border-r border-slate-200 px-3 py-2 text-xs ${row.has_quickbooks_bill ? "bg-white text-slate-700" : "bg-slate-100 text-slate-400"}`}>
                          {row.has_quickbooks_bill && row.quickbooks_attachment_files?.length ? (
                            <ul className="space-y-1" title={row.quickbooks_attachment_files.map((file) => file.name ?? "Unnamed file").join(", ")}>
                              {row.quickbooks_attachment_files.map((file, index) => <li key={`${file.id ?? file.name ?? "file"}-${index}`} className="truncate">{file.name || "Unnamed file"}</li>)}
                            </ul>
                          ) : <span>—</span>}
                        </td>
                      </>}
                      <td
                        title={`${new Date(row.created_at).toLocaleString("en-SG")}${row.created_by ? ` · Created by ${profiles.find((profile) => profile.id === row.created_by)?.full_name || profiles.find((profile) => profile.id === row.created_by)?.email || "Unknown user"}` : ""}`}
                        className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-xs text-slate-500"
                      >
                        {new Date(row.created_at).toLocaleDateString("en-SG")}
                      </td>
                      <td className="border-b border-slate-200 p-0 text-center">
                        <button
                          type="button"
                          disabled={!canDelete(row) || deletingId === row.id}
                          onClick={() => setPendingDelete(row)}
                          title={
                            canDelete(row)
                              ? "Delete payment voucher and linked subitem"
                              : "You can only edit payment vouchers for clients assigned to you"
                          }
                          className="inline-flex h-10 w-full items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 size={16} />
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
      {!collapsedVoucherGroups[group.id] && (
        <div className="border-t border-slate-200 px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setExpandedPickerGroups(
                new Set(clientSections.map((section) => section.id)),
              );
              setVoucherCreationGroup(group.id);
              setSelectedVoucherClientId(null);
              setOtherBillChoice(null);
              setBillDocumentPreview(null);
              setPrefillFileSignature(null);
              setVoucherDraft({
                cost: "",
                reason: "",
                relatedSubitemIds: [],
                courier: "",
                remarks: "",
              });
              const today = new Date().toISOString().slice(0, 10);
              setBillDraft({
                supplierId: "",
                mailingAddress: "",
                termId: "",
                billDate: today,
                dueDate: today,
                billNumber: "",
                memo: "",
                attachments: [],
                lines: [
                  {
                    categoryId: "",
                    description: "",
                    amount: "",
                    taxCodeId: "",
                  },
                ],
              });
              setPickerOpen(true);
            }}
            className="text-sm font-medium text-sky-700 hover:text-sky-800"
          >
            + Add payment voucher
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
            {columns.map((column, index) => (
              <div
                key={column.key}
                className="relative h-11 whitespace-nowrap border-b border-r border-slate-200 px-2 leading-[44px]"
              >
                {column.label}
                <button
                  aria-label={`Resize ${column.label || "actions"} column`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    resize(index, event.clientX, column.width);
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
            const client = clientsById.get(row.client_id);
            return (
              <div
                key={row.id}
                className="grid hover:bg-slate-50"
                style={{ gridTemplateColumns }}
              >
                {cell(
                  <div className="flex h-10 items-center truncate px-2 text-sm font-medium text-slate-700">
                    {client ? clientLabel(client) : "Deleted client"}
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
                    onDeleteOption={(value) =>
                      deleteLabel("additional_cost_status", value)
                    }
                    onUpdateOptionColor={(value, color) =>
                      manageLabel(
                        "additional_cost_status",
                        "color",
                        value,
                        color,
                      )
                    }
                    onRenameOption={(value, nextValue) =>
                      manageLabel(
                        "additional_cost_status",
                        "rename",
                        value,
                        nextValue,
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
                    onDeleteOption={(value) =>
                      deleteLabel("additional_cost_reason", value)
                    }
                    onUpdateOptionColor={(value, color) =>
                      manageLabel(
                        "additional_cost_reason",
                        "color",
                        value,
                        color,
                      )
                    }
                    onRenameOption={(value, nextValue) =>
                      manageLabel(
                        "additional_cost_reason",
                        "rename",
                        value,
                        nextValue,
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
                    onDeleteOption={(value) =>
                      deleteLabel("additional_cost_courier", value)
                    }
                    onUpdateOptionColor={(value, color) =>
                      manageLabel(
                        "additional_cost_courier",
                        "color",
                        value,
                        color,
                      )
                    }
                    onRenameOption={(value, nextValue) =>
                      manageLabel(
                        "additional_cost_courier",
                        "rename",
                        value,
                        nextValue,
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
                    className="flex h-10 items-center whitespace-nowrap px-2 text-xs text-slate-500"
                  >
                    {new Date(row.created_at).toLocaleDateString("en-SG")}
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
                    disabled={deletingId === row.id || !canDelete(row)}
                    title={
                      canDelete(row)
                        ? "Delete additional cost"
                        : "Only users assigned to this client can delete it"
                    }
                    onClick={() => setPendingDelete(row)}
                    className="flex h-10 w-full items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Delete additional cost"
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
          className="fixed inset-0 z-[300] flex items-center justify-center gap-5 bg-slate-950/35 p-4"
          role="dialog"
          aria-modal="true"
        >
          {billDocumentPreview ? (
            <aside className="hidden h-[calc(100vh-2rem)] w-[clamp(360px,36vw,680px)] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xl lg:flex lg:flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-700" title={billDocumentPreview.name}>{billDocumentPreview.name}</p>{billDocumentPreview.isPrefill ? <span className="text-xs font-medium text-sky-700">Used for prefill</span> : <span className="text-xs text-slate-500">Attachment preview</span>}</div>
                <button type="button" onClick={() => setBillDocumentPreview(null)} className="ml-2 rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Hide document preview"><X size={16} /></button>
              </div>
              {billDocumentPreview.type === "application/pdf" ? (
                <iframe title="Uploaded receipt or invoice" src={billDocumentPreview.url} className="min-h-0 flex-1 w-full bg-white" />
              ) : (
                <div className="min-h-0 flex-1 overflow-auto p-2"><img src={billDocumentPreview.url} alt="Uploaded receipt or invoice" className="w-full" /></div>
              )}
              {Object.keys(billDocumentPreview.confidence).length ? (
                <div className="border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">Extraction confidence: {Object.values(billDocumentPreview.confidence).filter(Boolean).length ? `${Math.round((Object.values(billDocumentPreview.confidence).filter(Boolean).reduce((total, value) => total + value, 0) / Object.values(billDocumentPreview.confidence).filter(Boolean).length) * 100)}%` : "not available"}. Verify all prefilled fields.</div>
              ) : null}
            </aside>
          ) : null}
          <div className={`flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl ${billDocumentPreview ? "max-w-none flex-1" : "max-w-6xl"}`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-800">
                  {selectedVoucherClientId
                    ? voucherCreationGroup === "other" && otherBillChoice === "add"
                      ? "Prepare QuickBooks Bill"
                      : "Payment voucher details"
                    : "Choose a client"}
                </h2>
                {selectedVoucherClientId ? (
                  <p className="mt-0.5 text-sm text-slate-500">
                    Complete the required payment voucher information.
                  </p>
                ) : null}
                <p
                  className={`mt-0.5 text-sm text-slate-500 ${selectedVoucherClientId ? "hidden" : ""}`}
                >
                  The client becomes this record’s Project Name.
                </p>
              </div>
              <button
                onClick={() => {
                  setPickerOpen(false);
                  setBillDocumentPreview(null);
                  setPrefillFileSignature(null);
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>
            {selectedVoucherClientId ? (
              voucherCreationGroup === "other" ? (
                <div className="min-h-0 space-y-4 overflow-y-auto p-5">
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
                  <section>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Project Name
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {clientLabel(clientsById.get(selectedVoucherClientId)!)}
                    </p>
                  </section>
                  {otherBillChoice === null ? (
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
                      <section className="border-t border-slate-200 pt-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-800">Bill</h3>
                            <p className="mt-1 text-sm text-slate-500">
                              {otherBillChoice === "none"
                                ? "No QuickBooks Bill will be created for this voucher."
                                : "Complete the details for the QuickBooks Bill."}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOtherBillChoice(null)}
                            className="text-sm text-sky-700 hover:underline"
                          >
                            Change
                          </button>
                        </div>
                        {otherBillChoice === "add" ? (
                          <div className="mt-4 space-y-4">
                              <label className="block rounded-lg border border-dashed border-sky-300 bg-sky-50 p-3 text-sm font-medium text-slate-700">
                                Upload Receipt/Invoice for Pre-filling
                                <span className="mt-1 block text-xs font-normal text-slate-500">Maximum 1 upload here for pre-filling, upload other files below.</span>
                                <span className="mt-1 block text-xs font-normal text-slate-500">PDF, JPEG, PNG, TIFF, BMP, or HEIF up to 4 MB. The original file is also added to the Bill attachments.</span>
                                <input type="file" accept="application/pdf,image/jpeg,image/png,image/tiff,image/bmp,image/heif" disabled={extractingBillDocument} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (!file) return; if (prefillFileSignature) setPendingExtractionFile(file); else void extractBillDocument(file); }} className="mt-2 block w-full text-sm font-normal text-slate-600" />
                                {extractingBillDocument ? <span className="mt-3 flex items-center gap-2 rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white"><LoaderCircle size={18} className="animate-spin" /> Reading file and extracting Bill details…</span> : null}
                              </label>
                            {billOptionsLoading ? (
                              <p className="text-sm text-slate-500">Loading QuickBooks options…</p>
                            ) : null}
                            {billOptionsError ? (
                              <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                {billOptionsError}
                              </p>
                            ) : null}
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="text-sm font-medium text-slate-700">Supplier *
                                <select required value={billDraft.supplierId} onChange={(event) => setBillDraft((draft) => ({ ...draft, supplierId: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 font-normal">
                                  <option value="">Choose a supplier</option>
                                  {billOptions.vendors.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                                </select>
                                {billDocumentPreview?.supplierSuggestion && billDraft.supplierId !== billDocumentPreview.supplierSuggestion.id ? (
                                  <button type="button" onClick={() => setBillDraft((draft) => ({ ...draft, supplierId: billDocumentPreview.supplierSuggestion!.id }))} className="mt-1 text-left text-xs font-normal text-sky-700 hover:underline">Use closest match: {billDocumentPreview.supplierSuggestion.name}</button>
                                ) : null}
                              </label>
                              <label className="text-sm font-medium text-slate-700">Terms
                                <select value={billDraft.termId} onChange={(event) => setBillDraft((draft) => ({ ...draft, termId: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 font-normal">
                                  <option value="">Choose terms</option>
                                  {billOptions.terms.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                                </select>
                              </label>
                              <label className="sm:col-span-2 text-sm font-medium text-slate-700">Mailing Address
                                <textarea value={billDraft.mailingAddress} onChange={(event) => setBillDraft((draft) => ({ ...draft, mailingAddress: event.target.value }))} className="mt-1 min-h-20 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
                              </label>
                              <label className="text-sm font-medium text-slate-700">Bill date
                                <input type="date" value={billDraft.billDate} onChange={(event) => setBillDraft((draft) => ({ ...draft, billDate: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
                              </label>
                              <label className="text-sm font-medium text-slate-700">Due date
                                <input type="date" value={billDraft.dueDate} onChange={(event) => setBillDraft((draft) => ({ ...draft, dueDate: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
                              </label>
                              <label className="text-sm font-medium text-slate-700">Invoice no. * <span className="font-normal text-slate-500">(Bill no. on QuickBooks)</span>
                                <input required value={billDraft.billNumber} onChange={(event) => setBillDraft((draft) => ({ ...draft, billNumber: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
                              </label>
                            </div>
                            <div>
                              <p className="mb-2 text-sm font-semibold text-slate-700">Expense lines</p>
                              <div className="overflow-x-auto rounded-md border border-slate-200">
                                <table className="min-w-[900px] w-full text-sm">
                                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr><th className="px-3 py-2">Category *</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Amount *</th><th className="px-3 py-2">GST *</th><th className="w-24 px-3 py-2"><span className="sr-only">Actions</span></th></tr>
                                  </thead>
                                  <tbody>
                                    {billDraft.lines.map((line, index) => (
                                      <tr key={index} className="border-t border-slate-200 align-top">
                                        <td className="px-3 py-2"><select required value={line.categoryId} onChange={(event) => setBillDraft((draft) => ({ ...draft, lines: draft.lines.map((current, currentIndex) => currentIndex === index ? { ...current, categoryId: event.target.value } : current) }))} className="w-full rounded border border-slate-300 bg-white px-3 py-2"><option value="">Choose a category</option>{billOptions.accounts.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></td>
                                        <td className="px-3 py-2"><input value={line.description} onChange={(event) => setBillDraft((draft) => ({ ...draft, lines: draft.lines.map((current, currentIndex) => currentIndex === index ? { ...current, description: event.target.value } : current) }))} className="w-full rounded border border-slate-300 px-3 py-2" /></td>
                                        <td className="px-3 py-2"><input required type="number" min="0.01" step="0.01" value={line.amount} onChange={(event) => setBillDraft((draft) => ({ ...draft, lines: draft.lines.map((current, currentIndex) => currentIndex === index ? { ...current, amount: event.target.value } : current) }))} className="w-full rounded border border-slate-300 px-3 py-2" /></td>
                                        <td className="px-3 py-2"><select required value={line.taxCodeId} onChange={(event) => setBillDraft((draft) => ({ ...draft, lines: draft.lines.map((current, currentIndex) => currentIndex === index ? { ...current, taxCodeId: event.target.value } : current) }))} className="w-full rounded border border-slate-300 bg-white px-3 py-2"><option value="">Choose GST</option>{billOptions.taxCodes.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></td>
                                        <td className="px-3 py-2">{billDraft.lines.length > 1 ? <button type="button" onClick={() => setBillDraft((draft) => ({ ...draft, lines: draft.lines.filter((_, currentIndex) => currentIndex !== index) }))} className="text-red-600 hover:underline">Remove</button> : null}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="border-t border-slate-200 bg-slate-50"><tr><td colSpan={5} className="px-3 py-2"><button type="button" onClick={() => setBillDraft((draft) => ({ ...draft, lines: [...draft.lines, { categoryId: "", description: "", amount: "", taxCodeId: "" }] }))} className="font-medium text-sky-700 hover:underline">+ Add expense line</button></td></tr></tfoot>
                                </table>
                              </div>
                            </div>
                            <label className="block text-sm font-medium text-slate-700">Memo *
                              <textarea required value={billDraft.memo} onChange={(event) => setBillDraft((draft) => ({ ...draft, memo: event.target.value }))} className="mt-1 min-h-20 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">Attachments
                              <span className="mt-1 block text-xs font-normal text-slate-500">Click any attachment to preview it in the left pane. Files used for prefill are marked.</span>
                              <input type="file" multiple onChange={(event) => setBillDraft((draft) => ({ ...draft, attachments: [...draft.attachments, ...Array.from(event.target.files ?? [])] }))} className="mt-1 block w-full text-sm font-normal text-slate-600" />
                            </label>
                            {billDraft.attachments.length ? <ul className="space-y-1 text-sm text-slate-600">{billDraft.attachments.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2"><button type="button" onClick={() => previewAttachment(file)} className="min-w-0 truncate text-left text-sky-700 hover:underline">{file.name}</button>{prefillFileSignature === `${file.name}-${file.lastModified}` ? <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">Used for prefill</span> : null}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setBillDraft((draft) => ({ ...draft, attachments: draft.attachments.filter((_, fileIndex) => fileIndex !== index) }))} className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-red-600"><X size={15} /></button></li>)}</ul> : null}
                          </div>
                        ) : null}
                      </section>
                      <section className="border-t border-slate-200 pt-4">
                        <h3 className="font-semibold text-slate-800">Voucher information</h3>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="text-sm font-medium text-slate-700">Cost *<input type="number" min="0.01" step="0.01" value={voucherDraft.cost} readOnly={otherBillChoice === "add"} onChange={(event) => setVoucherDraft((draft) => ({ ...draft, cost: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal read-only:bg-slate-100" />{otherBillChoice === "add" ? <span className="mt-1 block text-xs font-normal text-slate-500">Calculated from the expense-line amounts.</span> : null}</label>
                          <label className="text-sm font-medium text-slate-700">Reason *<div className="mt-1 h-10 overflow-hidden rounded border border-slate-300"><StatusBadge value={voucherDraft.reason} onChange={(reason) => setVoucherDraft((draft) => ({ ...draft, reason }))} options={labelOptions.additional_cost_reason ?? []} /></div></label>
                          <label className="text-sm font-medium text-slate-700">Related Subitems *{renderRelatedSubitemSelector(selectedVoucherClientId)}</label>
                        </div>
                        <label className="mt-3 block text-sm font-medium text-slate-700">Remarks{voucherDraft.reason.trim().toLocaleLowerCase() === "other" ? " * (Specify Reason)" : ""}<textarea value={voucherDraft.remarks} onChange={(event) => setVoucherDraft((draft) => ({ ...draft, remarks: event.target.value }))} className="mt-1 min-h-20 w-full rounded border border-slate-300 px-3 py-2 font-normal" /></label>
                      </section>
                      <button
                        type="button"
                        disabled={
                          otherBillChoice !== "add" ||
                          creatingFor !== null ||
                          !billDraft.supplierId ||
                          !billDraft.billNumber.trim() ||
                          !billDraft.memo.trim() ||
                          billDraft.lines.some((line) =>
                            !line.categoryId ||
                            Number(line.amount) <= 0 ||
                            !line.taxCodeId,
                          ) ||
                          Number(voucherDraft.cost) <= 0 ||
                          !voucherDraft.reason ||
                          !voucherDraft.relatedSubitemIds.length ||
                          (voucherDraft.reason.trim().toLocaleLowerCase() === "other" && !voucherDraft.remarks.trim())
                        }
                        onClick={() => void generateQuickBooksBill(selectedVoucherClientId)}
                        className="rounded bg-[#16a5c4] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {creatingFor ? "Creating QuickBooks Bill…" : "Create QuickBooks Bill and payment voucher"}
                      </button>
                    </>
                  )}
                </div>
              ) : (
              <div className="space-y-3 p-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVoucherClientId(null);
                    setBillDocumentPreview(null);
                    setPrefillFileSignature(null);
                  }}
                  className="text-sm text-sky-700 hover:underline"
                >
                  Change project
                </button>
                <p className="text-sm font-medium text-slate-700">
                  Project:{" "}
                  {clientLabel(clientsById.get(selectedVoucherClientId)!)}
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
                        onChange={(reason) =>
                          setVoucherDraft((draft) => ({
                            ...draft,
                            reason,
                          }))
                        }
                        options={labelOptions.additional_cost_reason ?? []}
                      />
                    </div>
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Related Subitems *
                    {renderRelatedSubitemSelector(selectedVoucherClientId)}
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Courier *
                    <div className="mt-1 h-10 overflow-hidden rounded border border-slate-300">
                      <StatusBadge
                        value={voucherDraft.courier}
                        onChange={(courier) =>
                          setVoucherDraft((draft) => ({
                            ...draft,
                            courier,
                          }))
                        }
                        options={(labelOptions.additional_cost_courier ?? []).filter(
                          (option) =>
                            !option.value ||
                            ["Lalamove", "Easyparcel"].includes(option.value),
                        )}
                      />
                    </div>
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700">
                  Remarks{voucherDraft.reason.trim().toLocaleLowerCase() === "other" ? " * (Specify Reason)" : ""}{" "}
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
                    !voucherDraft.relatedSubitemIds.length ||
                    !voucherDraft.courier
                    || (voucherDraft.reason.trim().toLocaleLowerCase() === "other" && !voucherDraft.remarks.trim())
                  }
                  onClick={() => void create(selectedVoucherClientId)}
                  className="rounded bg-[#16a5c4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {creatingFor ? "Creating…" : "Create payment voucher"}
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
                <div ref={pickerScrollRef} className="min-h-0 overflow-y-auto border-t border-slate-100 px-2 pb-2">
                  {clientSections.map((section) => {
                    const expanded = expandedPickerGroups.has(section.id);
                    return (
                      <div key={section.id}>
                        <button
                          type="button"
                          onClick={(event) => {
                            const header = event.currentTarget;
                            const collapsing = expandedPickerGroups.has(section.id);
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
                          className="sticky top-0 z-10 flex w-full items-center justify-between border-y border-slate-100 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-500 hover:bg-slate-100"
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
                                        Company: {client.company || "—"} · Email: {client.email || "—"}
                                      </span>
                                      <span className="mt-1 block truncate text-xs text-slate-400">
                                        Subitems ({client.subitems.length}): {client.subitems.length
                                          ? client.subitems
                                              .slice(0, 3)
                                              .map((subitem) => subitem.name || "Unnamed subitem")
                                              .join(", ") +
                                            (client.subitems.length > 3 ? "…" : "")
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
                      No matching clients.
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
      <AlertDialog
        open={Boolean(pendingExtractionFile)}
        onOpenChange={(open) => !open && setPendingExtractionFile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use this file for prefill?</AlertDialogTitle>
            <AlertDialogDescription>
              A document has already been used to prefill this Bill. Replacing it will use the new file for extraction and update the prefilled fields. Adding it as an attachment keeps the current prefill unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button type="button" onClick={() => {
              const file = pendingExtractionFile;
              setPendingExtractionFile(null);
              if (!file) return;
              setBillDraft((draft) => draft.attachments.some((attachment) => attachment.name === file.name && attachment.lastModified === file.lastModified) ? draft : { ...draft, attachments: [...draft.attachments, file] });
              previewAttachment(file);
            }} className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Add as attachment only</button>
            <AlertDialogAction onClick={(event) => {
              event.preventDefault();
              const file = pendingExtractionFile;
              setPendingExtractionFile(null);
              if (file) void extractBillDocument(file);
            }}>Replace and extract</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment voucher?</AlertDialogTitle>
            <AlertDialogDescription>
              This payment voucher and its linked CRM subitem will both be
              deleted. This action cannot be undone.
              {pendingDelete && !/lalamove|easyparcel/i.test(pendingDelete.courier)
                ? ` The QuickBooks Bill${pendingDelete.quickbooks_invoice_number ? ` (${pendingDelete.quickbooks_invoice_number})` : ""} is not deleted automatically; handle it directly in QuickBooks.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(deletingId)}
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) void remove(pendingDelete);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingId ? "Deleting…" : "Delete"}
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
              payment voucher’s Invoice No., Supplier, and Attached Files values. The Bill in
              QuickBooks itself will not be changed.
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
    </section>
  );
}

// for rendering client rows
"use client";
/* eslint-disable @next/next/no-img-element */

import {
  Client,
  Subitem,
  ClientStatus,
  ReplyStatus,
  ActivityEntry,
  Profile,
} from "../../app/types";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Activity,
  Trash2,
  ReceiptText,
  FileBox,
  Paperclip,
  Plus,
  Link as LinkIcon,
  FileText,
  X,
} from "lucide-react";
import { EditableCell } from "./editablecell";
import { StatusBadge } from "./statusbadge";
import { SubitemsTable } from "./subitems";
import { AssigneeMultiSelect } from "./assignee-multiselect";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "../ui/alert-dialog";
import { Tooltip } from "radix-ui";
import type { CustomColumn } from "@/lib/custom-columns";
import { calculateSubitemFinancials } from "@/lib/subitem-calculations";
import { useGenerateEstimate } from "@/components/hooks/use-generate-estimate-button";
import { ClientActionsMenu } from "@/components/ClientActionsMenu";
import { FileDropTarget } from "./file-drop-target";
import { uploadCrmFiles } from "@/lib/crm-files";
import { FilePreview } from "./file-preview";

type OptionEntry = { value: string; color: string };
const trackingSummaryOptions: OptionEntry[] = [
  { value: "Started", color: "#ffae3d" },
  { value: "Successful", color: "#16a34a" },
  { value: "Delivered", color: "#9748d7" },
  { value: "Discussed", color: "#0ea5e9" },
  { value: "Variation", color: "#a855f7" },
];
const trackingMultipleInvoiceOptions: OptionEntry[] = [
  { value: "Yes", color: "#f59e0b" },
  { value: "No", color: "#64748b" },
];
const trackingPaymentStatusOptions: OptionEntry[] = [
  "Not Delivered",
  "30days Credit terms",
  "NHG AP-Direct Done",
  "To Fill Up",
  "Submitted",
  "Gebiz Done",
  "Sesami Done",
  "Vendors@GOV Done",
  "Chase for payment",
  "Paypal Payment",
  "Tenderboard Done",
  "PAID",
  "Ariba Done",
  "To Verify Issues",
  "Partially PAID",
  "Coupa Done",
  "Cardup",
  "Partial Invoice",
  "Chase for PO",
  "Others (remarks)",
].map((value, index) => ({
  value,
  color: [
    "#ff5b57",
    "#e63959",
    "#5595f5",
    "#bfc0c2",
    "#f6c900",
    "#008bc4",
    "#ed5acb",
    "#835446",
    "#c52a50",
    "#008448",
    "#8bcf13",
    "#00c976",
    "#2f75d6",
    "#333333",
    "#ffae3d",
    "#5a5fd7",
    "#9748d7",
    "#777777",
    "#ec087a",
    "#54c2ed",
  ][index],
}));
type AttachmentItem = {
  id: string;
  kind: "file" | "link";
  name: string;
  url: string;
  mimeType?: string;
  actorName?: string;
  createdAt?: string;
  createdThrough?: string;
  storagePath?: string;
};

type SampleArtworkUpload = { name: string; url: string; mimeType: string };

function imageFileToArtwork(file: File): Promise<SampleArtworkUpload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        url: String(reader.result),
        mimeType: file.type || "image/png",
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function artworkUrlToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:image/")) return Promise.resolve(url);
  return fetch(url).then(async (response) => {
    if (!response.ok) throw new Error("Could not load saved artwork");
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  });
}

function readArtwork(value?: string): AttachmentItem | null {
  try {
    const parsed = JSON.parse(value ?? "");
    return parsed &&
      typeof parsed.url === "string" &&
      (parsed.url.startsWith("data:image/") ||
        parsed.mimeType?.startsWith("image/"))
      ? (parsed as AttachmentItem)
      : null;
  } catch {
    return null;
  }
}

export type ClientRowProps = {
  client: Client;
  isBlacklisted: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onUpdate: (u: Partial<Client>) => void;
  onUpdateSubitem: (subitemId: string, u: Partial<Subitem>) => void;
  onAddSubitem: (name: string) => void | Promise<void>;
  onDeleteSubitem: (id: string) => void;
  selectedSubitemIds: string[];
  onToggleSubitemSelection: (subitemId: string) => void;
  onToggleAllSubitems: (subitemIds: string[]) => void;
  onSubitemDragStart?: (
    subitemId: string,
    event: React.DragEvent<HTMLElement>,
  ) => void;
  onSubitemDragEnd?: () => void;
  onSubitemRowDragOver?: (
    event: React.DragEvent<HTMLTableRowElement>,
    subitemId: string,
  ) => void;
  onSubitemRowDrop?: (
    event: React.DragEvent<HTMLTableRowElement>,
    subitemId: string,
  ) => void;
  subitemDropMarker?: { subitemId: string; edge: "top" | "bottom" } | null;
  onSubitemDragOver?: (
    event: React.DragEvent<HTMLDivElement>,
    clientId: string,
  ) => void;
  onSubitemDrop?: (
    event: React.DragEvent<HTMLDivElement>,
    clientId: string,
  ) => void;
  isSubitemDropTarget?: boolean;
  onDelete: () => void;
  canDelete: boolean;
  onOpenOcfModal: (client: Client) => void;
  onOpenDetail: () => void;
  profiles: Profile[];
  clientAssignedIds: string[];
  onChangeClientAssignees: (ids: string[]) => void;
  clientPmAssignedIds: string[];
  onChangeClientPmAssignees: (ids: string[]) => void;
  subitemAssigneeMap: Record<string, string[]>;
  onChangeSubitemAssignees: (subitemId: string, ids: string[]) => void;
  colWidth: Record<string, number>;
  boardWidth: number;
  columnOrderMap: Record<string, number>;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  replyStatusOptions: OptionEntry[];
  statusOptions: OptionEntry[];
  channelOptions: OptionEntry[];
  importanceOptions: OptionEntry[];
  progressOptions: OptionEntry[];
  onAddReplyStatus?: (name: string) => void | Promise<void>;
  onDeleteReplyStatus?: (name: string) => void | Promise<void>;
  onAddStatus?: (name: string) => void | Promise<void>;
  onDeleteStatus?: (name: string) => void | Promise<void>;
  onAddChannel?: (name: string) => void | Promise<void>;
  onDeleteChannel?: (name: string) => void | Promise<void>;
  onAddImportance?: (name: string) => void | Promise<void>;
  onDeleteImportance?: (name: string) => void | Promise<void>;
  onAddProgress?: (name: string) => void | Promise<void>;
  onDeleteProgress?: (name: string) => void | Promise<void>;
  paymentOptions: OptionEntry[];
  paymentStatusOptions: OptionEntry[];
  modeOfPaymentOptions: OptionEntry[];
  shipperOptions: OptionEntry[];
  localOverseasOptions: OptionEntry[];
  subitemStatusOptions: OptionEntry[];
  currencyOptions: OptionEntry[];
  subitemSubprogressOptions: OptionEntry[];
  onAddSubitemSubprogress: (name: string) => void | Promise<void>;
  onDeleteSubitemSubprogress: (name: string) => void | Promise<void>;
  onAddCurrency: (name: string) => void | Promise<void>;
  onDeleteCurrency: (name: string) => void | Promise<void>;
  onAddSubitemStatus: (name: string) => void | Promise<void>;
  onDeleteSubitemStatus: (name: string) => void | Promise<void>;
  onAddLocalOverseas: (name: string) => void | Promise<void>;
  onDeleteLocalOverseas: (name: string) => void | Promise<void>;
  onAddShipper?: (name: string) => void | Promise<void>;
  onDeleteShipper?: (name: string) => void | Promise<void>;
  onAddPayment?: (name: string) => void | Promise<void>;
  onDeletePayment?: (name: string) => void | Promise<void>;
  onAddPaymentStatus?: (name: string) => void | Promise<void>;
  onDeletePaymentStatus?: (name: string) => void | Promise<void>;
  onAddModeOfPayment?: (name: string) => void | Promise<void>;
  onDeleteModeOfPayment?: (name: string) => void | Promise<void>;
  onUpdateOptionColor?: (
    code: string,
    name: string,
    color: string,
  ) => void | Promise<void>;
  onRenameOption?: (
    code: string,
    oldName: string,
    newName: string,
  ) => void | Promise<void>;
  onFilterColumn?: (column: string) => void;
  onSortColumn?: (
    category: "subitem" | "payment",
    column: string,
    direction: "asc" | "desc",
  ) => void;
  clientCustomCols: CustomColumn[];
  subitemCustomCols: CustomColumn[];
  onDeleteCustomColumn: (id: string) => void;
  onRequestAddSubitemCol: () => void;
  hiddenColumnKeys: Set<string>;
  onHideColumn: (key: string) => void;
  onSetColumnVisibility: (key: string, visible: boolean) => void;
  updateClientCustomField: (
    clientId: string,
    columnId: string,
    value: string,
  ) => void | Promise<void>;
  currentUserRole?: string | null;
  currentUserId?: string | null;
  onPushToShipperView?: (subitemId: string) => void | Promise<void>;
  onUndoActivity?: (entry: ActivityEntry) => void | Promise<void>;
  groupNamesById: Record<string, string>;
  groups: Array<{ id: string; name: string }>;
  onDuplicateClient: () => void | Promise<void>;
  onMoveClient: (groupId: string) => void | Promise<void>;
  subitemMoveTargetGroups: Array<{
    name: string;
    clients: Array<{ id: string; name: string }>;
  }>;
  onDuplicateSubitemAction: (subitemId: string) => void | Promise<void>;
  onMoveSubitemAction: (
    subitemId: string,
    targetClientId: string,
  ) => void | Promise<void>;
  onOpenSubitemDetail?: (subitemId: string) => void;
  trackingMode?: boolean;
};

export function ClientRow({
  client,
  isBlacklisted,
  isSelected,
  isExpanded,
  onToggleExpand,
  onToggleSelect,
  onUpdate,
  onUpdateSubitem,
  onAddSubitem,
  onDeleteSubitem,
  selectedSubitemIds,
  onToggleSubitemSelection,
  onToggleAllSubitems,
  onSubitemDragStart,
  onSubitemDragEnd,
  onSubitemRowDragOver,
  onSubitemRowDrop,
  subitemDropMarker,
  onSubitemDragOver,
  onSubitemDrop,
  isSubitemDropTarget,
  onDelete,
  canDelete,
  onOpenOcfModal,
  onOpenDetail,
  profiles,
  clientAssignedIds,
  onChangeClientAssignees,
  clientPmAssignedIds,
  onChangeClientPmAssignees,
  subitemAssigneeMap,
  onChangeSubitemAssignees,
  colWidth,
  boardWidth,
  columnOrderMap,
  onDragStart,
  onDragEnd,
  isDragging,
  replyStatusOptions,
  statusOptions,
  channelOptions,
  importanceOptions,
  progressOptions,
  onAddReplyStatus,
  onDeleteReplyStatus,
  onAddStatus,
  onDeleteStatus,
  onAddChannel,
  onDeleteChannel,
  onAddImportance,
  onDeleteImportance,
  onAddProgress,
  onDeleteProgress,
  paymentOptions,
  paymentStatusOptions,
  modeOfPaymentOptions,
  shipperOptions,
  localOverseasOptions,
  subitemStatusOptions,
  currencyOptions,
  subitemSubprogressOptions,
  onAddSubitemSubprogress,
  onDeleteSubitemSubprogress,
  onAddCurrency,
  onDeleteCurrency,
  onAddSubitemStatus,
  onDeleteSubitemStatus,
  onAddLocalOverseas,
  onDeleteLocalOverseas,
  onAddShipper,
  onDeleteShipper,
  onAddPayment,
  onDeletePayment,
  onAddPaymentStatus,
  onDeletePaymentStatus,
  onAddModeOfPayment,
  onDeleteModeOfPayment,
  onUpdateOptionColor,
  onRenameOption,
  onFilterColumn,
  onSortColumn,
  clientCustomCols,
  subitemCustomCols,
  onDeleteCustomColumn,
  onRequestAddSubitemCol,
  hiddenColumnKeys,
  onHideColumn,
  onSetColumnVisibility,
  updateClientCustomField,
  currentUserRole,
  currentUserId,
  onPushToShipperView,
  onUndoActivity,
  groupNamesById,
  groups,
  onDuplicateClient,
  onMoveClient,
  subitemMoveTargetGroups,
  onDuplicateSubitemAction,
  onMoveSubitemAction,
  onOpenSubitemDetail,
  trackingMode = false,
}: ClientRowProps) {
  const [permissionNotice, setPermissionNotice] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [blacklistNotice, setBlacklistNotice] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const showPermissionNotice = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setPermissionNotice({
      left: Math.min(rect.left, window.innerWidth - 300),
      top: Math.min(rect.bottom + 8, window.innerHeight - 48),
    });
    window.setTimeout(() => setPermissionNotice(null), 2600);
  };
  const pmProfiles = profiles.filter(
    (profile) => profile.role?.toLowerCase() === "pm",
  );
  const pmAssignedIds = clientPmAssignedIds;
  const canEditClient =
    !!currentUserId &&
    (clientAssignedIds.includes(currentUserId) ||
      pmAssignedIds.includes(currentUserId));
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showMultipleInvoicesDialog, setShowMultipleInvoicesDialog] =
    useState(false);
  const [pendingTrackingInvoiceNumber, setPendingTrackingInvoiceNumber] =
    useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ClientStatus | null>(null);
  const [closeFiles, setCloseFiles] = useState<File[]>([]);
  const [closeConfirmed, setCloseConfirmed] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showOnlyAttachedActivities, setShowOnlyAttachedActivities] =
    useState(false);
  const [undoneActivityIds, setUndoneActivityIds] = useState<Set<string>>(
    new Set(),
  );
  const [attachmentDrafts, setAttachmentDrafts] = useState<
    Record<string, string>
  >({});
  const [attachmentSourceMenu, setAttachmentSourceMenu] = useState<
    string | null
  >(null);
  const [attachmentLinkDialog, setAttachmentLinkDialog] = useState<
    string | null
  >(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(
    null,
  );
  const [pendingAttachmentRemoval, setPendingAttachmentRemoval] = useState<{
    fieldKey: string;
    id: string;
    name: string;
  } | null>(null);
  const [showEstimateDialog, setShowEstimateDialog] = useState(false);
  const [estimateMode, setEstimateMode] = useState<
    "choice" | "quickbooks" | "sample"
  >("choice");
  const [estimateResult, setEstimateResult] = useState<{
    estimateId?: string | null;
    docNumber?: string | null;
  } | null>(null);
  const [sampleEstimate, setSampleEstimate] = useState<{
    filename: string;
    url: string;
  } | null>(null);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [sampleEstimateError, setSampleEstimateError] = useState<string | null>(
    null,
  );
  const [sampleArtworkUploads, setSampleArtworkUploads] = useState<
    Record<string, SampleArtworkUpload>
  >({});
  const setMultipleInvoices = (value: "Yes" | "No") => {
    onUpdate({
      customFields: {
        ...(client.customFields ?? {}),
        ...(pendingTrackingInvoiceNumber !== null
          ? { trackingInvoiceNumber: pendingTrackingInvoiceNumber }
          : {}),
        trackingMultipleInvoices: value,
      },
    });
    setPendingTrackingInvoiceNumber(null);
    setShowMultipleInvoicesDialog(false);
  };
  const deferMultipleInvoicesDecision = () => {
    setPendingTrackingInvoiceNumber(null);
    setShowMultipleInvoicesDialog(false);
  };
  const {
    handleGenerateEstimate,
    isGeneratingEstimate,
    estimateError,
    resetEstimateState,
  } = useGenerateEstimate();
  const estimateEligibleSubitems = client.subitems.filter((subitem) =>
    ["Quoted", "Shortlisted", "Awarded"].includes(subitem.status?.trim()),
  );
  const sampleEstimateArtwork = estimateEligibleSubitems.map((subitem) => ({
    subitem,
    artwork:
      sampleArtworkUploads[subitem.id] ??
      readArtwork(subitem.customFields?.artworkFile),
  }));
  const missingSampleEstimateArtwork = sampleEstimateArtwork.filter(
    ({ artwork }) => !artwork,
  );
  const generateEstimate = async () => {
    try {
      const result = (await handleGenerateEstimate(client.id)) as {
        estimateId?: string | null;
        docNumber?: string | null;
      };
      setEstimateResult(result);
    } catch {
      // The hook already retains the error for the result state in this dialog.
    }
  };
  const generateSampleEstimate = async () => {
    setIsGeneratingSample(true);
    setSampleEstimateError(null);
    try {
      const preparedArtwork = await Promise.all(
        sampleEstimateArtwork.map(async ({ subitem, artwork }) => ({
          subitemId: subitem.id,
          dataUrl: artwork ? await artworkUrlToDataUrl(artwork.url) : "",
        })),
      );
      const response = await fetch("/api/estimates/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          artworks: preparedArtwork,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result?.error || "Could not generate sample estimate");
      const attachment: AttachmentItem = {
        id: crypto.randomUUID(),
        kind: "file",
        name: result.filename,
        url: result.url,
        storagePath: result.storagePath,
        mimeType: "application/pdf",
        actorName: result.createdBy,
        createdAt: result.createdAt,
        createdThrough: "Created through CRM app",
      };
      let current: AttachmentItem[] = [];
      try {
        const parsed = JSON.parse(
          client.customFields?.filesMiscellaneous ?? "[]",
        );
        if (Array.isArray(parsed)) current = parsed;
      } catch {}
      await updateClientCustomField(
        client.id,
        "filesMiscellaneous",
        JSON.stringify([...current, attachment]),
      );
      sampleEstimateArtwork.forEach(({ subitem, artwork }) => {
        const uploaded = sampleArtworkUploads[subitem.id];
        if (!uploaded || !artwork) return;
        onUpdateSubitem(subitem.id, {
          customFields: {
            ...subitem.customFields,
            artworkFile: JSON.stringify({
              id: crypto.randomUUID(),
              kind: "file",
              name: uploaded.name,
              url: uploaded.url,
              mimeType: uploaded.mimeType,
            }),
          },
        });
      });
      setSampleEstimate({ filename: result.filename, url: result.url });
    } catch (error: unknown) {
      setSampleEstimateError(
        error instanceof Error
          ? error.message
          : "Could not generate sample estimate",
      );
    } finally {
      setIsGeneratingSample(false);
    }
  };

  useEffect(() => {
    if (!attachmentSourceMenu) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("[data-attachment-menu-trigger], [data-attachment-menu]")
      )
        return;
      setAttachmentSourceMenu(null);
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [attachmentSourceMenu]);

  // normalise dates
  function toDateInputValue(value: unknown): string {
    if (!value) return "";

    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

      if (/^\d+$/.test(value)) {
        const serial = Number(value);
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const date = new Date(excelEpoch.getTime() + serial * 86400000);

        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }

      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, "0");
        const day = String(parsed.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }

      return "";
    }

    if (typeof value === "number") {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + value * 86400000);

      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    return "";
  }
  const renderAttachmentField = (fieldKey: string) => {
    const rawValue = String(client.customFields?.[fieldKey] ?? "");
    const draft = attachmentDrafts[fieldKey] ?? "";
    const parseItems = (): AttachmentItem[] => {
      try {
        const parsed = JSON.parse(rawValue) as unknown;
        if (Array.isArray(parsed))
          return parsed.filter((item): item is AttachmentItem =>
            Boolean(item && typeof item === "object" && "url" in item),
          );
      } catch {
        if (rawValue) {
          return [
            {
              id: `legacy-${fieldKey}`,
              kind: /^https?:\/\//i.test(rawValue) ? "link" : "file",
              name: /^https?:\/\//i.test(rawValue) ? rawValue : "Attachment",
              url: rawValue,
            },
          ];
        }
      }
      return [];
    };

    const items = parseItems();
    const saveItems = (nextItems: AttachmentItem[]) =>
      updateClientCustomField(client.id, fieldKey, JSON.stringify(nextItems));
    const addItem = (item: AttachmentItem) => {
      saveItems([...items, item]);
      setAttachmentSourceMenu(null);
      setAttachmentLinkDialog(null);
    };

    const addFiles = async (files: File[]) => {
      try {
        const nextItems = (
          await uploadCrmFiles(
            files,
            `client-columns/${client.id}/${fieldKey}`,
            { clientId: client.id },
          )
        ).map((file) => ({ ...file, kind: "file" as const }));
        if (nextItems.length) saveItems([...items, ...nextItems]);
      } finally {
        setAttachmentSourceMenu(null);
      }
    };

    const removeItem = (item: AttachmentItem) =>
      setPendingAttachmentRemoval({
        fieldKey,
        id: item.id,
        name: item.name,
      });

    return (
      <FileDropTarget
        onFiles={(files) => {
          void addFiles(files);
        }}
        className="group/attachment min-h-[34px]"
      >
        <div className="relative flex min-h-[34px] items-center gap-1 px-1 py-0.5">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {items.map((item) => (
              <div
                key={item.id}
                className="relative shrink-0"
                onMouseEnter={() =>
                  setAttachmentPreview(`${fieldKey}:${item.id}`)
                }
                onMouseLeave={() => setAttachmentPreview(null)}
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  title={item.name}
                  className="flex h-7 w-8 items-center justify-center overflow-hidden rounded border border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-400"
                >
                  {item.kind === "link" ? (
                    <LinkIcon size={13} />
                  ) : (
                    <FilePreview
                      url={item.url}
                      name={item.name}
                      mimeType={item.mimeType}
                      className="h-full w-full border-0"
                    />
                  )}
                </a>
                {attachmentPreview === `${fieldKey}:${item.id}` && (
                  <div className="pointer-events-none absolute bottom-full left-0 z-[100] mb-1 w-64 rounded-md border border-slate-200 bg-white p-2 shadow-xl">
                    {item.kind !== "link" ? (
                      <FilePreview
                        url={item.url}
                        name={item.name}
                        mimeType={item.mimeType}
                        size="large"
                        className="h-52 w-full object-contain"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 text-[11px] text-slate-700">
                        <FileText size={16} />{" "}
                        <span className="break-words">{item.name}</span>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  title="Remove attachment"
                  className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[10px] text-slate-500 shadow group-hover/attachment:flex hover:text-red-500"
                >
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            data-attachment-menu-trigger
            onClick={() =>
              setAttachmentSourceMenu(
                attachmentSourceMenu === fieldKey ? null : fieldKey,
              )
            }
            className="flex h-7 w-7 shrink-0 items-center justify-center gap-0.5 rounded text-slate-400 opacity-0 transition-opacity group-hover/attachment:opacity-100 hover:bg-sky-50 hover:text-sky-600"
            title="Add attachment"
          >
            <Plus size={12} />
            <FileText size={14} />
          </button>
          {attachmentSourceMenu === fieldKey && (
            <div
              data-attachment-menu
              className="absolute right-0 top-full z-[110] mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-xs text-slate-700 hover:bg-slate-50">
                <Paperclip size={14} /> From computer
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void addFiles(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setAttachmentSourceMenu(null);
                  setAttachmentLinkDialog(fieldKey);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
              >
                <LinkIcon size={14} /> From link
              </button>
            </div>
          )}
          {attachmentLinkDialog === fieldKey && (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-4"
              onMouseDown={() => setAttachmentLinkDialog(null)}
            >
              <div
                className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-800">
                    Add link
                  </h3>
                  <button
                    type="button"
                    onClick={() => setAttachmentLinkDialog(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) =>
                    setAttachmentDrafts((previous) => ({
                      ...previous,
                      [fieldKey]: event.target.value,
                    }))
                  }
                  placeholder="Paste a link"
                  className="mb-3 h-9 w-full rounded border border-slate-200 px-2 text-sm outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  disabled={!draft.trim()}
                  onClick={() =>
                    addItem({
                      id: crypto.randomUUID(),
                      kind: "link",
                      name: draft.trim(),
                      url: draft.trim(),
                    })
                  }
                  className="w-full rounded bg-sky-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  Add link
                </button>
              </div>
            </div>
          )}
        </div>
      </FileDropTarget>
    );
  };

  const confirmAttachmentRemoval = async () => {
    if (!pendingAttachmentRemoval) return;
    const { fieldKey, id } = pendingAttachmentRemoval;
    const rawValue = String(client.customFields?.[fieldKey] ?? "");
    let items: AttachmentItem[] = [];

    try {
      const parsed = JSON.parse(rawValue) as unknown;
      if (Array.isArray(parsed)) {
        items = parsed.filter(
          (item): item is AttachmentItem =>
            Boolean(item && typeof item === "object" && "url" in item),
        );
      }
    } catch {
      if (rawValue) {
        items = [
          {
            id: `legacy-${fieldKey}`,
            kind: /^https?:\/\//i.test(rawValue) ? "link" : "file",
            name: /^https?:\/\//i.test(rawValue) ? rawValue : "Attachment",
            url: rawValue,
          },
        ];
      }
    }

    await updateClientCustomField(
      client.id,
      fieldKey,
      JSON.stringify(items.filter((item) => item.id !== id)),
    );
    setPendingAttachmentRemoval(null);
  };

  const aggregateSubitemValues = client.subitems.reduce(
    (totals, subitem) => {
      const { price, markup } = calculateSubitemFinancials(subitem);

      return {
        totalPrice: totals.totalPrice + price,
        totalMarkup: totals.totalMarkup + markup,
      };
    },
    { totalPrice: 0, totalMarkup: 0 },
  );

  const clientCreationActivity = client.activityLog?.find(
    (entry) => entry.action === "client_added",
  );
  const clientCreatedTooltip = client.createdAt
    ? `Created by ${clientCreationActivity?.actorName ?? "Unknown user"} on ${new Date(client.createdAt).toLocaleDateString("en-GB")} at ${new Date(client.createdAt).toLocaleTimeString("en-GB")}`
    : "";

  // activity log text
  function displayLogValue(value: unknown) {
    if (value == null || value === "") return "empty";

    if (Array.isArray(value)) {
      return `${value.length} item(s)`;
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    return String(value);
  }

  function displayActivityValue(fieldName: string | undefined, value: unknown) {
    if (fieldName === "groupId" && value) {
      return groupNamesById[String(value)] ?? String(value);
    }
    return displayLogValue(value);
  }
  function renderActivityText(entry: ActivityEntry) {
    const isRetiredFileDescription =
      entry.description === "File has been removed" ||
      entry.description === "File has been replaced";

    if (entry.title || (entry.description && !isRetiredFileDescription)) {
      return (
        <>
          {entry.title ? (
            <span className="font-medium">{entry.title}</span>
          ) : null}
          {entry.description && !isRetiredFileDescription ? (
            <>
              {entry.title ? "  " : ""}
              <span className="text-gray-700">{entry.description}</span>
            </>
          ) : null}
        </>
      );
    }

    if (entry.action === "field_changed") {
      return (
        <>
          changed <span className="font-medium">{entry.fieldName}</span> from{" "}
          <span className="text-gray-600">
            {displayActivityValue(entry.fieldName, entry.oldValue ?? "empty")}
          </span>{" "}
          to{" "}
          <span className="text-gray-600">
            {displayActivityValue(entry.fieldName, entry.newValue ?? "empty")}
          </span>
        </>
      );
    }

    if (entry.action === "client_added") {
      return <>created this client</>;
    }

    if (entry.action === "subitem_added") {
      return <>added a subitem</>;
    }

    if (entry.action === "subitem_deleted") {
      return <>deleted a subitem</>;
    }

    if (entry.action === "subitem_field_changed") {
      const fieldName = entry.fieldName ?? "";

      if (fieldName.startsWith("timeline:")) {
        const [, rowName, changedField] = fieldName.split(":");

        return (
          <>
            changed subitem{" "}
            <span className="font-medium">
              {entry.subitemName ?? "Subitem"}
            </span>{" "}
            timeline row <span className="font-medium">{rowName}</span> field{" "}
            <span className="font-medium">{changedField}</span> from{" "}
            <span className="text-gray-600">
              {displayLogValue(entry.oldValue)}
            </span>{" "}
            to{" "}
            <span className="text-gray-600">
              {displayLogValue(entry.newValue)}
            </span>
          </>
        );
      }

      return (
        <>
          changed subitem{" "}
          <span className="font-medium">{entry.subitemName ?? "Subitem"}</span>{" "}
          field <span className="font-medium">{entry.fieldName}</span> from{" "}
          <span className="text-gray-600">
            {displayLogValue(entry.oldValue)}
          </span>{" "}
          to{" "}
          <span className="text-gray-600">
            {displayLogValue(entry.newValue)}
          </span>
        </>
      );
    }

    return <>{entry.action ?? "activity recorded"}</>;
  }

  return (
    <div
      className={`mb-0 w-fit min-w-0 ${isSubitemDropTarget ? "ring-2 ring-inset ring-[#0f8da8]" : ""}`}
      onDragOver={(event) => onSubitemDragOver?.(event, client.id)}
      onDrop={(event) => onSubitemDrop?.(event, client.id)}
    >
      <style>{`${Array.from(hiddenColumnKeys)
        .filter((key) => key.startsWith("client:"))
        .map(
          (key) =>
            `[data-client-column="${key.slice(7)}"]{display:none!important}`,
        )
        .join(
          "",
        )} ${trackingMode ? '[data-client-row] [data-client-column]:not([data-client-column="selectCheckbox"]):not([data-client-column="client"]):not([data-client-column="people"]):not([data-client-column="channel"]):not([data-client-column^="custom:"]):not(.tracking-client-cell){display:none!important}' : ""}`}</style>
      {permissionNotice && (
        <div
          role="alert"
          className="fixed z-[10000] rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white shadow-xl"
          style={permissionNotice}
        >
          You can only edit items that are assigned to you
        </div>
      )}
      {blacklistNotice && (
        <div
          role="alert"
          className="pointer-events-none fixed z-[10010] rounded-md border border-red-700 bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-xl"
          style={blacklistNotice}
        >
          This client is in the blacklist
        </div>
      )}
      <AlertDialog
        open={showEstimateDialog}
        onOpenChange={(open) => {
          setShowEstimateDialog(open);
          if (!open) {
            setEstimateResult(null);
            setSampleEstimate(null);
            setSampleEstimateError(null);
            setSampleArtworkUploads({});
            setEstimateMode("choice");
            resetEstimateState();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {estimateMode === "choice"
                ? "Generate estimate"
                : estimateMode === "sample"
                  ? sampleEstimate
                    ? "Sample estimate created"
                    : sampleEstimateError
                      ? "Could not create sample estimate"
                      : "Generate sample estimate?"
                  : estimateResult
                    ? "QuickBooks estimate created"
                    : estimateError
                      ? "Could not create QuickBooks estimate"
                      : "Generate QuickBooks estimate?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {estimateMode === "choice" ? (
                "Choose whether to create a PDF preview or send an estimate to QuickBooks."
              ) : estimateMode === "sample" ? (
                sampleEstimate ? (
                  <>
                    The PDF sample estimate was saved under this client’s
                    Miscellaneous files.
                  </>
                ) : sampleEstimateError ? (
                  sampleEstimateError
                ) : (
                  <>
                    This preview uses the same eligible subitems but does not
                    create or change anything in QuickBooks.
                  </>
                )
              ) : estimateResult ? (
                <>
                  An estimate has been created for{" "}
                  <strong>{client.company || client.name}</strong>
                  {estimateResult.docNumber ? (
                    <>
                      {" "}
                      with document number{" "}
                      <strong>{estimateResult.docNumber}</strong>
                    </>
                  ) : (
                    ""
                  )}
                  .
                </>
              ) : estimateError ? (
                estimateError
              ) : (
                <>
                  This will find or create the QuickBooks customer for{" "}
                  <strong>{client.company || "this client"}</strong> and create
                  an estimate using the {estimateEligibleSubitems.length}{" "}
                  eligible subitem
                  {estimateEligibleSubitems.length === 1 ? "" : "s"}.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {estimateMode === "sample" &&
            !sampleEstimate &&
            !sampleEstimateError && (
              <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
                <p className="font-medium text-slate-800">
                  Add or replace Artwork without leaving this dialog
                </p>
                {estimateEligibleSubitems.map((subitem) => (
                  <div
                    key={subitem.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0 truncate">
                      {subitem.name || "Unnamed subitem"}
                    </span>
                    <label className="shrink-0 cursor-pointer rounded border border-sky-200 bg-sky-50 px-2 py-1 text-sky-700 hover:bg-sky-100">
                      Upload image
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          if (
                            readArtwork(subitem.customFields?.artworkFile) &&
                            !sampleArtworkUploads[subitem.id] &&
                            !window.confirm(
                              "This will replace the saved Artwork for this subitem after the sample estimate is created. Continue?",
                            )
                          )
                            return;
                          void imageFileToArtwork(file)
                            .then((upload) =>
                              setSampleArtworkUploads((current) => ({
                                ...current,
                                [subitem.id]: upload,
                              })),
                            )
                            .catch(() =>
                              setSampleEstimateError(
                                "Could not read that artwork image.",
                              ),
                            );
                        }}
                      />
                    </label>
                  </div>
                ))}
              </div>
            )}
          {estimateMode === "sample" &&
            !sampleEstimate &&
            !sampleEstimateError && (
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-sky-100 bg-sky-50 p-3 text-xs text-slate-600">
                <p className="font-medium text-slate-800">
                  Artwork included in this sample estimate
                </p>
                {sampleEstimateArtwork.map(({ subitem, artwork }) => (
                  <div
                    key={subitem.id}
                    className="flex items-center gap-3 rounded border border-slate-200 bg-white p-2"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-50">
                      {artwork ? (
                        <img
                          src={artwork.url}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-center text-[10px] text-red-600">
                          Artwork required
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">
                        {subitem.name || "Unnamed subitem"}
                      </p>
                      <p
                        className={
                          artwork ? "text-emerald-700" : "text-red-600"
                        }
                      >
                        {artwork
                          ? "Saved Artwork will be used"
                          : "Upload an image in Files (Images) > Artwork before generating."}
                      </p>
                    </div>
                  </div>
                ))}
                {missingSampleEstimateArtwork.length > 0 && (
                  <p className="pt-1 font-medium text-red-600">
                    Every eligible subitem needs an Artwork image before the PDF
                    can be generated.
                  </p>
                )}
              </div>
            )}
          {estimateMode === "choice" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setEstimateMode("sample")}
                className="rounded-xl border-2 border-sky-200 bg-sky-50 p-5 text-left hover:border-sky-400"
              >
                <strong className="block text-base text-sky-800">
                  Generate sample estimate
                </strong>
                <span className="mt-1 block text-xs text-slate-600">
                  Create and save a PDF preview. Nothing is sent to QuickBooks.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setEstimateMode("quickbooks")}
                className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 text-left hover:border-emerald-400"
              >
                <strong className="block text-base text-emerald-800">
                  Generate QuickBooks estimate
                </strong>
                <span className="mt-1 block text-xs text-slate-600">
                  Create the customer/items if needed, then send the estimate to
                  QuickBooks.
                </span>
              </button>
            </div>
          ) : (
            !estimateResult &&
            !estimateError &&
            !sampleEstimate &&
            !sampleEstimateError && (
              <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-medium text-slate-700">Included subitems</p>
                <ul className="mt-1 list-disc pl-4">
                  {estimateEligibleSubitems.map((subitem) => (
                    <li key={subitem.id}>
                      {subitem.name || "Unnamed subitem"} — {subitem.status}
                    </li>
                  ))}
                </ul>
                {!client.company.trim() && (
                  <p className="mt-2 text-red-600">
                    A Company name is required before generating an estimate.
                  </p>
                )}
                {!estimateEligibleSubitems.length && (
                  <p className="mt-2 text-red-600">
                    At least one subitem must be Quoted, Shortlisted, or
                    Awarded.
                  </p>
                )}
              </div>
            )
          )}
          <AlertDialogFooter>
            {estimateMode === "choice" ? (
              <AlertDialogCancel>Cancel</AlertDialogCancel>
            ) : estimateMode === "sample" ? (
              sampleEstimate || sampleEstimateError ? (
                <>
                  <AlertDialogAction
                    onClick={() => setShowEstimateDialog(false)}
                  >
                    Close
                  </AlertDialogAction>
                  {sampleEstimate && (
                    <a
                      href={sampleEstimate.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                    >
                      Open PDF
                    </a>
                  )}
                </>
              ) : (
                <>
                  <AlertDialogCancel disabled={isGeneratingSample}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={
                      isGeneratingSample ||
                      !client.company.trim() ||
                      !estimateEligibleSubitems.length
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      void generateSampleEstimate();
                    }}
                  >
                    {isGeneratingSample ? "Generating…" : "Generate sample PDF"}
                  </AlertDialogAction>
                </>
              )
            ) : estimateResult || estimateError ? (
              <AlertDialogAction onClick={() => setShowEstimateDialog(false)}>
                Close
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel disabled={isGeneratingEstimate}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={
                    isGeneratingEstimate ||
                    !client.company.trim() ||
                    !estimateEligibleSubitems.length
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    void generateEstimate();
                  }}
                >
                  {isGeneratingEstimate ? "Generating…" : "Generate estimate"}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div
        data-client-row
        data-client-id={client.id}
        onContextMenu={(event) => {
          event.preventDefault();
          window.dispatchEvent(
            new CustomEvent("crm:client-actions", { detail: client.id }),
          );
        }}
        onMouseMove={(event) => {
          const column = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-client-column]",
          )?.dataset.clientColumn;
          const blacklistField =
            isBlacklisted && (column === "client" || column === "phone");
          if (blacklistField) {
            setPermissionNotice(null);
            setBlacklistNotice({
              left: Math.min(event.clientX + 12, window.innerWidth - 230),
              top: Math.min(event.clientY + 16, window.innerHeight - 48),
            });
            event.currentTarget.title = "";
            return;
          }
          setBlacklistNotice(null);
          event.currentTarget.title =
            !canEditClient &&
            column &&
            !["people", "pm", "selectCheckbox"].includes(column)
              ? "You can only edit items that are assigned to you"
              : "";
        }}
        onMouseLeave={() => setBlacklistNotice(null)}
        onClickCapture={(event) => {
          const target = event.target as HTMLElement;
          const column = target.closest<HTMLElement>("[data-client-column]")
            ?.dataset.clientColumn;
          if (isBlacklisted && (column === "client" || column === "phone")) {
            const rect = target.getBoundingClientRect();
            setPermissionNotice(null);
            setBlacklistNotice({
              left: Math.min(rect.left, window.innerWidth - 230),
              top: Math.min(rect.bottom + 8, window.innerHeight - 48),
            });
          }
          if (canEditClient) return;
          const isAssignmentColumn =
            column === "people" ||
            column === "pm" ||
            column === "selectCheckbox";
          const isEditControl = !!target.closest(
            "button, input, textarea, select, [data-editable-cell]",
          );
          if (
            !isAssignmentColumn &&
            column &&
            isEditControl &&
            !target.closest("[data-view-action], [data-activity-log]")
          ) {
            event.preventDefault();
            event.stopPropagation();
            if (!(isBlacklisted && (column === "client" || column === "phone")))
              showPermissionNotice(target);
          }
        }}
        style={{ width: boardWidth, minWidth: boardWidth }}
        className="box-border border-b flex text-[15px] items-center flex-shrink-0 border-r border-[#D0D4E4] group transition-colors"
      >
        <div
          data-client-column="selectCheckbox"
          className="group/client-actions box-border relative flex min-w-0 self-stretch items-center px-3 flex-shrink-0 overflow-visible"
          style={{
            minWidth: colWidth.selectCheckbox,
            width: colWidth.selectCheckbox,
            order: columnOrderMap.selectCheckbox ?? 0,
          }}
        >
          <ClientActionsMenu
            clientId={client.id}
            clientName={client.name}
            groups={groups}
            canEdit={canDelete}
            onOpen={onOpenDetail}
            onDuplicate={onDuplicateClient}
            onMove={onMoveClient}
            onDelete={onDelete}
            align="left"
            className="absolute -left-7 top-1/2 z-30 -translate-y-1/2"
            triggerClassName="opacity-0 transition-opacity group-hover/client-actions:opacity-100"
          />
          <input
            data-selection-control
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            disabled={selectedSubitemIds.length > 0}
            title={
              selectedSubitemIds.length > 0
                ? "Clients and subitems cannot be selected together"
                : "Select client"
            }
            className={`w-3 h-3 rounded accent-[#7BCBD5] transition transform active:scale-150 duration-200 ${selectedSubitemIds.length > 0 ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
          />
          {!trackingMode && (
            <button
              data-selection-control
              onClick={onToggleExpand}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown
                  size={14}
                  className="transition transform active:scale-150 duration-100"
                />
              ) : (
                <ChevronRight
                  size={14}
                  className="transition transform active:scale-150 duration-100"
                />
              )}
            </button>
          )}
        </div>

        <div
          draggable
          data-client-column="client"
          onDragStart={(event) => onDragStart(event)}
          onDragEnd={onDragEnd}
          onClick={(event) => {
            if (
              !(event.target as HTMLElement).closest(
                "button, input, [data-editable-cell], [data-activity-log]",
              )
            )
              onOpenDetail();
          }}
          className={`group/client box-border relative flex items-center min-w-0 px-1 border-r border-[#D0D4E4] overflow-visible ${isDragging ? "opacity-40" : ""} ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{
            height: 30,
            minWidth: colWidth.client,
            width: colWidth.client,
            order: columnOrderMap.client ?? 1,
          }}
        >
          <div className="min-w-0 flex items-left">
            <EditableCell
              value={client.name}
              onChange={(v) => onUpdate({ name: v })}
              placeholder="Client name"
              className={`font-semibold ${isBlacklisted ? "bg-red-100 !text-red-700 ring-1 ring-inset ring-red-300" : "text-gray-800"}`}
            />
          </div>
          <div className="ml-auto flex items-center justify-start gap-1 flex-shrink-0">
            {trackingMode && (
              <button
                type="button"
                data-view-action
                disabled
                title="Invoice retrieval will be connected here soon"
                className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700 opacity-70 disabled:cursor-not-allowed"
              >
                Pull Invoice
              </button>
            )}
            {!trackingMode && (
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      data-view-action
                      onClick={() => setShowActivityLog(true)}
                      onPointerDown={(event) => event.stopPropagation()}
                      className="flex whitespace-nowrap px-2 py-1 text-[10px] font-medium text-cyan-500 hover:bg-gray-50 hover:text-cyan-600 transition transform active:scale-95 duration-150"
                    >
                      <Activity
                        size={10}
                        className="transition transform active:scale-150 duration-200"
                      />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="TooltipContent">
                      View activity log
                      <Tooltip.Arrow className="TooltipArrow" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            )}
            {showActivityLog && (
              <div
                data-activity-log
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
                onPointerDown={(event) => event.stopPropagation()}
                onDragStart={(event) => event.stopPropagation()}
              >
                <div
                  className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl"
                  onPointerDown={(event) => event.stopPropagation()}
                  onDragStart={(event) => event.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">
                        Activity Log
                      </h2>
                      <p className="text-[12.6px] text-gray-500">
                        {client.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setShowOnlyAttachedActivities((previous) => !previous)
                        }
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                          showOnlyAttachedActivities
                            ? "border-teal-300 bg-teal-100 text-teal-700"
                            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        }`}
                        title="Filter to activities with an attached file"
                        aria-pressed={showOnlyAttachedActivities}
                      >
                        <FileBox size={13} />
                        {showOnlyAttachedActivities
                          ? "Attached files"
                          : "Filter activities with attached files"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowActivityLog(false)}
                        className="text-[12.6px] text-gray-500 hover:text-gray-700"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[420px] space-y-3 overflow-y-auto">
                    {(() => {
                      const clientActivities = [...(client.activityLog ?? [])]
                        .filter(
                          (entry) =>
                            !entry.subitemId ||
                            [
                              "subitem_added",
                              "subitem_deleted",
                              "shipper_pushed",
                              "file_uploaded",
                              "file_replaced",
                              "file_removed",
                            ].includes(entry.action),
                        )
                        .filter(
                          (entry) =>
                            !showOnlyAttachedActivities || Boolean(entry.link),
                        )
                        .sort(
                          (a, b) =>
                            new Date(b.createdAt).getTime() -
                            new Date(a.createdAt).getTime(),
                        );

                      if (clientActivities.length === 0) {
                        return (
                          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                            {showOnlyAttachedActivities
                              ? "No activities with attached files yet."
                              : "No activity yet."}
                          </div>
                        );
                      }

                      return clientActivities.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-gray-800">
                                {entry.actorName ? (
                                  <>
                                    <span className="font-medium">
                                      {entry.actorName}
                                    </span>{" "}
                                  </>
                                ) : null}
                                {renderActivityText(entry)}
                              </p>
                              <p className="mt-1 text-[12.6px] text-gray-500">
                                {new Date(entry.createdAt).toLocaleString(
                                  "en-GB",
                                )}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-start gap-2">
                              {entry.link ? (
                                <a
                                  href={entry.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded-md bg-teal-100 px-2 py-1 text-[12.6px] font-medium text-teal-500 hover:bg-teal-200"
                                >
                                  {entry.action === "estimate_created" ||
                                  String(
                                    entry.meta?.fileName ?? "",
                                  ).startsWith("Sample Estimate")
                                    ? "Open Estimate"
                                    : "Open OCF"}
                                </a>
                              ) : null}
                              {entry.description === "File has been removed" ? (
                                <span
                                  className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[12.6px] font-medium text-slate-500"
                                  title="This file is no longer available"
                                >
                                  File has been removed
                                </span>
                              ) : entry.description === "File has been replaced" ? (
                                <span
                                  className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[12.6px] font-medium text-slate-500"
                                  title="This file has been replaced"
                                >
                                  File has been replaced
                                </span>
                              ) : null}
                              {(entry.action === "field_changed" ||
                                entry.action === "subitem_field_changed") &&
                                entry.oldValue !== undefined &&
                                entry.oldValue !== null && (
                                <button
                                  type="button"
                                  disabled={
                                    undoneActivityIds.has(entry.id) ||
                                    !canEditClient
                                  }
                                  onClick={async () => {
                                    if (undoneActivityIds.has(entry.id)) return;
                                    await onUndoActivity?.(entry);
                                    setUndoneActivityIds((previous) =>
                                      new Set(previous).add(entry.id),
                                    );
                                  }}
                                  title={
                                    !canEditClient
                                      ? "You can only edit items that are assigned to you"
                                      : undoneActivityIds.has(entry.id)
                                        ? "The action has already been undone"
                                        : "Undo this action"
                                  }
                                  className="shrink-0 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {undoneActivityIds.has(entry.id)
                                    ? "Undone"
                                    : "Undo"}
                                </button>
                                )}
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}
            {!trackingMode && (
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setEstimateResult(null);
                        setSampleEstimate(null);
                        setSampleEstimateError(null);
                        setEstimateMode("choice");
                        resetEstimateState();
                        setShowEstimateDialog(true);
                      }}
                      className="px-2 py-2 text-[10px] font-medium text-teal-500"
                      aria-label="Generate sample estimate or QuickBooks estimate"
                    >
                      <ReceiptText
                        size={15}
                        color="#7BCBD5"
                        className="transition transform active:scale-150 duration-200"
                      />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="TooltipContent">
                      Generate sample / QuickBooks estimate
                      <Tooltip.Arrow className="TooltipArrow" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            )}
            {!trackingMode && (
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => onOpenOcfModal(client)}
                      className="px-2 py-2 text-[10px] font-medium text-teal-500"
                    >
                      {" "}
                      <FileBox
                        size={15}
                        color="#7BCBD5"
                        className="transition transform active:scale-150 duration-200"
                      />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="TooltipContent">
                      Order Confirmation Form
                      <Tooltip.Arrow className="TooltipArrow" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            )}
          </div>
        </div>
        <div
          data-client-column="people"
          className="flex-1 min-w-0 py-1 overflow-hidden whitespace-nowrap text-ellipsis border-r border-[#D0D4E4]"
          style={{
            minWidth: colWidth.people,
            width: colWidth.people,
            order: columnOrderMap.people ?? 2,
          }}
        >
          <div data-assignment-editor>
            <AssigneeMultiSelect
              profiles={profiles}
              selectedIds={clientAssignedIds}
              onChange={onChangeClientAssignees}
            />
          </div>
        </div>

        <div
          data-client-column="pm"
          className="flex-1 min-w-0 py-1 overflow-hidden whitespace-nowrap text-ellipsis border-r border-[#D0D4E4]"
          style={{
            minWidth: colWidth.pm,
            width: colWidth.pm,
            order: columnOrderMap.pm ?? 3,
          }}
        >
          <div data-assignment-editor>
            <AssigneeMultiSelect
              profiles={pmProfiles}
              selectedIds={pmAssignedIds}
              onChange={onChangeClientPmAssignees}
            />
          </div>
        </div>

        <div
          data-client-column="replyStatus"
          className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] transition transform active:scale-95 duration-150"
          style={{
            minWidth: colWidth.replyStatus,
            width: colWidth.replyStatus,
            order: columnOrderMap.replyStatus ?? 3,
          }}
        >
          <StatusBadge
            value={client.replyStatus}
            onChange={(v) => onUpdate({ replyStatus: v as ReplyStatus })}
            options={replyStatusOptions}
            onAddOption={onAddReplyStatus}
            onDeleteOption={onDeleteReplyStatus}
            manageLabel="reply status"
            onUpdateOptionColor={(name, color) =>
              onUpdateOptionColor?.("reply_status", name, color)
            }
            onRenameOption={(oldName, newName) =>
              onRenameOption?.("reply_status", oldName, newName)
            }
          />
        </div>

        <div
          data-client-column="followUp"
          className="flex-1 min-w-0 py-1 overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-1 border-[#D0D4E4] transition transform active:scale-95 duration-150"
          style={{
            minWidth: colWidth.followUp,
            width: colWidth.followUp,
            order: columnOrderMap.followUp ?? 4,
          }}
        >
          <input
            type="date"
            value={toDateInputValue(client.followUp)}
            onChange={(e) => onUpdate({ followUp: e.target.value })}
            className={`text-[12.6px] px-1 border-none outline-none bg-transparent cursor-pointer w-full ${toDateInputValue(client.followUp) ? "text-gray-700" : "text-transparent focus:text-gray-700"}`}
          />
        </div>

        <div
          data-client-column="status"
          className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150"
          style={{
            minWidth: colWidth.status,
            width: colWidth.status,
            order: columnOrderMap.status ?? 5,
          }}
        >
          <StatusBadge
            value={client.status}
            onChange={(v) => {
              const nextStatus = v as ClientStatus;
              onUpdate({ status: nextStatus });
            }}
            options={statusOptions}
            onAddOption={onAddStatus}
            onDeleteOption={onDeleteStatus}
            manageLabel="status"
            onUpdateOptionColor={(name, color) =>
              onUpdateOptionColor?.("client_status", name, color)
            }
            onRenameOption={(oldName, newName) =>
              onRenameOption?.("client_status", oldName, newName)
            }
          />

          <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close this client?</AlertDialogTitle>
                <AlertDialogDescription>
                  Please upload the required files and confirm before marking
                  this client as Closed.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-4 py-2">
                <div>
                  <FileDropTarget
                    onFiles={setCloseFiles}
                    className="rounded-md"
                  >
                    <label className="text-sm font-medium">
                      Upload purchase order
                    </label>
                    <input
                      type="file"
                      multiple
                      className="file:rounded-md file:border-0 file:font-semibold file:bg-[#7BCBD5] file:text-[#ffffff] hover:file:bg-[#6db6bf] file:mr-4 mt-2 block text-sm transition transform active:scale-95 duration-150"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setCloseFiles(files);
                      }}
                    />
                  </FileDropTarget>
                  <br />
                  <FileDropTarget
                    onFiles={setCloseFiles}
                    className="rounded-md"
                  >
                    <label className="text-sm font-medium">
                      Upload signed quotation
                    </label>
                    <input
                      type="file"
                      multiple
                      className="file:rounded-md file:border-0 file:font-semibold file:bg-[#7BCBD5] file:text-[#ffffff] hover:file:bg-[#6db6bf] file:mr-4 mt-2 block text-sm transition transform active:scale-95 duration-150"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setCloseFiles(files);
                      }}
                    />
                  </FileDropTarget>
                  <br />
                  <FileDropTarget
                    onFiles={setCloseFiles}
                    className="rounded-md"
                  >
                    <label className="text-sm font-medium">
                      Upload proof of payment
                    </label>
                    <input
                      type="file"
                      multiple
                      className="file:rounded-md file:border-0 file:font-semibold file:bg-[#7BCBD5] file:text-[#ffffff] hover:file:bg-[#6db6bf] file:mr-4 mt-2 block text-sm transition transform active:scale-95 duration-150"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setCloseFiles(files);
                      }}
                    />
                  </FileDropTarget>
                  {closeFiles.length > 0 && (
                    <div className="mt-2 text-[12.6px] text-gray-500 font-semibold">
                      {closeFiles.length} file(s) selected
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm font-semibold transition transform active:scale-95 duration-150">
                  <input
                    type="checkbox"
                    checked={closeConfirmed}
                    onChange={(e) => setCloseConfirmed(e.target.checked)}
                  />
                  OCF signed?
                </label>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setPendingStatus(null);
                    setCloseFiles([]);
                    setCloseConfirmed(false);
                  }}
                >
                  Cancel
                </AlertDialogCancel>

                <AlertDialogAction
                  onClick={(e) => {
                    if (
                      !closeFiles.length ||
                      !closeConfirmed ||
                      pendingStatus !== "Closed"
                    ) {
                      e.preventDefault();
                      return;
                    }

                    onUpdate({
                      status: "Closed",
                    });

                    setShowCloseDialog(false);
                    setPendingStatus(null);
                    setCloseFiles([]);
                    setCloseConfirmed(false);
                  }}
                >
                  Confirm Close
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div
          data-client-column="channel"
          className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150"
          style={{
            minWidth: colWidth.channel,
            width: colWidth.channel,
            order: columnOrderMap.channel ?? 6,
          }}
        >
          <StatusBadge
            value={client.channel}
            onChange={(v) => onUpdate({ channel: v })}
            options={channelOptions}
            onAddOption={onAddChannel}
            onDeleteOption={onDeleteChannel}
            manageLabel="channel"
            onUpdateOptionColor={(name, color) =>
              onUpdateOptionColor?.("channel", name, color)
            }
            onRenameOption={(oldName, newName) =>
              onRenameOption?.("channel", oldName, newName)
            }
          />
        </div>

        <div
          data-client-column="importance"
          className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150"
          style={{
            minWidth: colWidth.importance,
            width: colWidth.importance,
            order: columnOrderMap.importance ?? 7,
          }}
        >
          <StatusBadge
            value={client.importance}
            onChange={(v) => onUpdate({ importance: v })}
            options={importanceOptions}
            onAddOption={onAddImportance}
            onDeleteOption={onDeleteImportance}
            manageLabel="importance"
            onUpdateOptionColor={(name, color) =>
              onUpdateOptionColor?.("importance", name, color)
            }
            onRenameOption={(oldName, newName) =>
              onRenameOption?.("importance", oldName, newName)
            }
          />
        </div>

        <div
          data-client-column="company"
          className="min-w-0 py-1 w-full overflow-hidden border-r border-[#D0D4E4] whitespace-nowrap text-ellipsis"
          style={{
            height: 30,
            minWidth: colWidth.company,
            width: colWidth.company,
            order: columnOrderMap.company ?? 8,
          }}
        >
          <EditableCell
            className="!justify-start px-1"
            value={client.company}
            onChange={(v) => onUpdate({ company: v })}
            placeholder=""
          />
        </div>

        <div
          data-client-column="billingAddress"
          className="flex-1 min-w-0 overflow-hidden border-r border-[#D0D4E4] py-1.5 whitespace-nowrap text-ellipsis"
          style={{
            height: 30,
            minWidth: colWidth.billingAddress,
            width: colWidth.billingAddress,
            order: columnOrderMap.billingAddress ?? 9,
          }}
        >
          <EditableCell
            value={client.billingAddress}
            onChange={(v) => onUpdate({ billingAddress: v })}
            className="!justify-start px-1"
          />
        </div>

        <div
          data-client-column="email"
          className="flex-1 min-w-0 items-center py-1 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis text-blue-600"
          style={{
            height: 30,
            minWidth: colWidth.email,
            width: colWidth.email,
            order: columnOrderMap.email ?? 9,
          }}
        >
          <EditableCell
            className="!justify-start px-1 text-blue-600"
            value={client.email}
            onChange={(v) => onUpdate({ email: v })}
            placeholder=""
          />
        </div>

        <div
          data-client-column="phone"
          className={`flex-1 min-w-0 py-1 items-center border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis ${isBlacklisted ? "bg-red-100 text-red-700" : "text-blue-600"}`}
          style={{
            height: 30,
            minWidth: colWidth.phone,
            width: colWidth.phone,
            order: columnOrderMap.phone ?? 10,
          }}
        >
          <EditableCell
            className={
              isBlacklisted
                ? "bg-red-100 !text-red-700 ring-1 ring-inset ring-red-300"
                : "text-blue-600"
            }
            value={client.phone}
            onChange={(v) => onUpdate({ phone: v })}
            placeholder=""
          />
        </div>

        <div
          data-client-column="requirements"
          className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis"
          style={{
            height: 30,
            minWidth: colWidth.requirements,
            width: colWidth.requirements,
            order: columnOrderMap.requirements ?? 11,
          }}
        >
          <EditableCell
            className="!justify-start px-1"
            value={client.requirements}
            onChange={(v) => onUpdate({ requirements: v })}
            placeholder=""
          />
        </div>
        <div
          data-client-column="nbd"
          className="flex items-center border-r border-[#D0D4E4] transition transform active:scale-95 duration-150"
          style={{
            height: 30,
            minWidth: colWidth.nbd,
            width: colWidth.nbd,
            order: columnOrderMap.nbd ?? 12,
          }}
        >
          <input
            type="date"
            value={toDateInputValue(client.nbd)}
            onChange={(e) => onUpdate({ nbd: e.target.value })}
            className={`text-[12.6px] border-none outline-none bg-transparent cursor-pointer w-full ${toDateInputValue(client.nbd) ? "text-gray-700" : "text-transparent focus:text-gray-700"}`}
          />
        </div>
        <div
          data-client-column="logoRequirementsFile"
          className="flex-1 min-w-0 border-r border-[#D0D4E4] overflow-visible bg-white"
          style={{
            height: 30,
            minWidth: colWidth.logoRequirementsFile,
            width: colWidth.logoRequirementsFile,
            order: columnOrderMap.logoRequirementsFile ?? 13,
          }}
        >
          {renderAttachmentField("logoRequirementsFile")}
        </div>
        <div
          data-client-column="filesMiscellaneous"
          className="flex-1 min-w-0 border-r border-[#D0D4E4] overflow-visible bg-white"
          style={{
            height: 30,
            minWidth: colWidth.filesMiscellaneous,
            width: colWidth.filesMiscellaneous,
            order: columnOrderMap.filesMiscellaneous ?? 14,
          }}
        >
          {renderAttachmentField("filesMiscellaneous")}
        </div>
        <div
          data-client-column="totalPrice"
          className="flex-1 min-w-0 overflow-hidden border-r border-[#D0D4E4] bg-amber-50 py-1.5 whitespace-nowrap text-ellipsis"
          style={{
            height: 30,
            minWidth: colWidth.totalPrice,
            width: colWidth.totalPrice,
            order: columnOrderMap.totalPrice ?? 15,
          }}
        >
          <span className="block px-2 text-center text-[12.6px] font-medium text-amber-950">
            {aggregateSubitemValues.totalPrice.toFixed(2)}
          </span>
        </div>
        <div
          data-client-column="totalMarkup"
          className="flex-1 min-w-0 overflow-hidden border-r border-[#D0D4E4] bg-amber-50 py-1.5 whitespace-nowrap text-ellipsis"
          style={{
            height: 30,
            minWidth: colWidth.totalMarkup,
            width: colWidth.totalMarkup,
            order: columnOrderMap.totalMarkup ?? 16,
          }}
        >
          <span className="block px-2 text-center text-[12.6px] font-medium text-amber-950">
            {aggregateSubitemValues.totalMarkup.toFixed(2)}
          </span>
        </div>
        <div
          data-client-column="progress"
          className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150"
          style={{
            minWidth: colWidth.progress,
            width: colWidth.progress,
            order: columnOrderMap.progress ?? 17,
          }}
        >
          <StatusBadge
            value={client.progress}
            onChange={(value) => onUpdate({ progress: value })}
            options={progressOptions}
            onAddOption={onAddProgress}
            onDeleteOption={onDeleteProgress}
            manageLabel="progress"
            onUpdateOptionColor={(name, color) =>
              onUpdateOptionColor?.("progress", name, color)
            }
            onRenameOption={(oldName, newName) =>
              onRenameOption?.("progress", oldName, newName)
            }
          />
        </div>
        {trackingMode && (
          <>
            <div
              data-client-column="trackingSummary"
              className="tracking-client-cell overflow-hidden border-r border-[#D0D4E4] p-0"
              style={{
                height: 30,
                minWidth: colWidth.trackingSummary,
                width: colWidth.trackingSummary,
                order: columnOrderMap.trackingSummary,
              }}
            >
              <StatusBadge
                value={client.customFields?.trackingSummary ?? ""}
                onChange={(value) =>
                  onUpdate({
                    customFields: {
                      ...(client.customFields ?? {}),
                      trackingSummary: value,
                    },
                  })
                }
                options={trackingSummaryOptions}
                manageLabel="tracking summary"
              />
            </div>
            <div
              data-client-column="trackingEstimateNumber"
              className="tracking-client-cell overflow-hidden border-r border-[#D0D4E4] py-1"
              style={{
                height: 30,
                minWidth: colWidth.trackingEstimateNumber,
                width: colWidth.trackingEstimateNumber,
                order: columnOrderMap.trackingEstimateNumber,
              }}
            >
              <EditableCell
                value={client.customFields?.trackingEstimateNumber ?? ""}
                onChange={(value) =>
                  onUpdate({
                    customFields: {
                      ...(client.customFields ?? {}),
                      trackingEstimateNumber: value,
                    },
                  })
                }
              />
            </div>
            <div
              data-client-column="trackingInvoiceNumber"
              className="tracking-client-cell overflow-hidden border-r border-[#D0D4E4] py-1"
              style={{
                height: 30,
                minWidth: colWidth.trackingInvoiceNumber,
                width: colWidth.trackingInvoiceNumber,
                order: columnOrderMap.trackingInvoiceNumber,
              }}
            >
              <EditableCell
                value={client.customFields?.trackingInvoiceNumber ?? ""}
                onChange={(value) => {
                  onUpdate({
                    customFields: {
                      ...(client.customFields ?? {}),
                      trackingInvoiceNumber: value,
                    },
                  });

                  if (
                    value.trim() &&
                    !client.customFields?.trackingMultipleInvoices
                  ) {
                    setPendingTrackingInvoiceNumber(value);
                    setShowMultipleInvoicesDialog(true);
                  }
                }}
              />
            </div>
            <div
              data-client-column="trackingMultipleInvoices"
              className={`tracking-client-cell overflow-hidden border-r p-0 ${client.customFields?.trackingInvoiceNumber && !client.customFields?.trackingMultipleInvoices ? "border-2 border-red-500 bg-red-50" : "border-[#D0D4E4]"}`}
              style={{
                height: 30,
                minWidth: colWidth.trackingMultipleInvoices,
                width: colWidth.trackingMultipleInvoices,
                order: columnOrderMap.trackingMultipleInvoices,
              }}
            >
              <StatusBadge
                value={client.customFields?.trackingMultipleInvoices ?? ""}
                onChange={(value) =>
                  onUpdate({
                    customFields: {
                      ...(client.customFields ?? {}),
                      trackingMultipleInvoices: value,
                    },
                  })
                }
                options={trackingMultipleInvoiceOptions}
                manageLabel="multiple invoices"
              />
            </div>
            <div
              data-client-column="trackingPaymentStatus"
              className="tracking-client-cell overflow-hidden border-r border-[#D0D4E4] p-0"
              style={{
                height: 30,
                minWidth: colWidth.trackingPaymentStatus,
                width: colWidth.trackingPaymentStatus,
                order: columnOrderMap.trackingPaymentStatus,
              }}
            >
              <StatusBadge
                value={
                  client.customFields?.trackingPaymentStatus || "To Fill Up"
                }
                onChange={(value) =>
                  onUpdate({
                    customFields: {
                      ...(client.customFields ?? {}),
                      trackingPaymentStatus: value,
                    },
                  })
                }
                options={trackingPaymentStatusOptions}
                manageLabel="tracking payment status"
                includeBlankOption={false}
              />
            </div>
          </>
        )}
        <div
          data-client-column="dateCreated"
          className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis"
          style={{
            height: 30,
            minWidth: colWidth.dateCreated,
            width: colWidth.dateCreated,
            order: columnOrderMap.dateCreated ?? 19,
          }}
        >
          <span
            title={clientCreatedTooltip}
            className="block px-1 text-[12.6px] text-gray-700"
          >
            {client.createdAt
              ? new Date(client.createdAt).toLocaleDateString("en-GB")
              : "-"}
          </span>
        </div>
        {/* custom cols */}
        {clientCustomCols.map((col) => (
          <div
            key={col.id}
            data-client-column={`custom:${col.id}`}
            className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap bg-teal-50/20"
            style={{
              height: 30,
              minWidth: colWidth[`custom:${col.id}`] ?? 120,
              width: colWidth[`custom:${col.id}`] ?? 120,
              order: columnOrderMap[`custom:${col.id}`] ?? 17,
            }}
          >
            {col.field_type === "date" ? (
              <input
                type="date"
                value={toDateInputValue(
                  String(client.customFields?.[col.id] ?? ""),
                )}
                onChange={(e) =>
                  updateClientCustomField(client.id, col.id, e.target.value)
                }
                className={`text-[12.6px] border-none outline-none bg-transparent cursor-pointer w-full px-1 ${client.customFields?.[col.id] ? "text-gray-700" : "text-transparent focus:text-gray-700"}`}
              />
            ) : (
              <EditableCell
                value={String(client.customFields?.[col.id] ?? "")}
                onChange={(v) =>
                  updateClientCustomField(client.id, col.id, String(v))
                }
                type={col.field_type}
              />
            )}
          </div>
        ))}
        {!trackingMode && (
          <div
            className="flex-shrink-0 border-r border-[#D0D4E4]"
            style={{
              height: 30,
              minWidth: colWidth.addClientCol ?? 44,
              width: colWidth.addClientCol ?? 44,
              order: columnOrderMap.addClientCol ?? 999,
            }}
          />
        )}
        {/* delete button */}
        <div
          className="flex items-center flex-shrink-0"
          style={{
            minWidth: colWidth.empty,
            width: colWidth.empty,
            order: columnOrderMap.empty ?? 1000,
          }}
        >
          <button
            onClick={onDelete}
            disabled={!canDelete}
            title={
              canDelete
                ? "Delete client"
                : "You can only delete items that are assigned to you"
            }
            className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-300"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {!trackingMode && isExpanded && (
        <SubitemsTable
          clientId={client.id}
          subitems={client.subitems}
          clientColor={"#7BCBD5"}
          onUpdateSubitem={onUpdateSubitem}
          onAddSubitem={onAddSubitem}
          onDeleteSubitem={onDeleteSubitem}
          selectedSubitemIds={selectedSubitemIds}
          onToggleSubitemSelection={onToggleSubitemSelection}
          clientIsSelected={isSelected}
          onToggleAllSubitems={onToggleAllSubitems}
          onSubitemDragStart={onSubitemDragStart}
          onSubitemDragEnd={onSubitemDragEnd}
          onSubitemRowDragOver={onSubitemRowDragOver}
          onSubitemRowDrop={onSubitemRowDrop}
          subitemDropMarker={subitemDropMarker}
          profiles={profiles}
          clientAssignedIds={clientAssignedIds}
          clientPmAssignedIds={pmAssignedIds}
          subitemAssigneeMap={subitemAssigneeMap}
          onChangeSubitemAssignees={onChangeSubitemAssignees}
          paymentOptions={paymentOptions}
          paymentStatusOptions={paymentStatusOptions}
          modeOfPaymentOptions={modeOfPaymentOptions}
          shipperOptions={shipperOptions}
          localOverseasOptions={localOverseasOptions}
          subitemStatusOptions={subitemStatusOptions}
          currencyOptions={currencyOptions}
          subitemSubprogressOptions={subitemSubprogressOptions}
          onAddSubitemSubprogress={onAddSubitemSubprogress}
          onDeleteSubitemSubprogress={onDeleteSubitemSubprogress}
          onAddCurrency={onAddCurrency}
          onDeleteCurrency={onDeleteCurrency}
          onAddSubitemStatus={onAddSubitemStatus}
          onDeleteSubitemStatus={onDeleteSubitemStatus}
          onAddLocalOverseas={onAddLocalOverseas}
          onDeleteLocalOverseas={onDeleteLocalOverseas}
          onAddShipper={onAddShipper}
          onDeleteShipper={onDeleteShipper}
          onAddPayment={onAddPayment}
          onDeletePayment={onDeletePayment}
          onAddPaymentStatus={onAddPaymentStatus}
          onDeletePaymentStatus={onDeletePaymentStatus}
          onAddModeOfPayment={onAddModeOfPayment}
          onDeleteModeOfPayment={onDeleteModeOfPayment}
          subitemCustomCols={subitemCustomCols}
          onDeleteSubitemCustomCol={onDeleteCustomColumn}
          onRequestAddSubitemCol={onRequestAddSubitemCol}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          onUpdateOptionColor={onUpdateOptionColor}
          onRenameOption={onRenameOption}
          onFilterColumn={onFilterColumn}
          onSortColumn={onSortColumn}
          hiddenColumnKeys={hiddenColumnKeys}
          onHideColumn={onHideColumn}
          onSetColumnVisibility={onSetColumnVisibility}
          onPushToShipperView={onPushToShipperView}
          clientActivityLog={client.activityLog ?? []}
          onUndoActivity={onUndoActivity}
          moveTargetGroups={subitemMoveTargetGroups}
          onDuplicateSubitemAction={onDuplicateSubitemAction}
          onMoveSubitemAction={onMoveSubitemAction}
          onOpenSubitemDetail={onOpenSubitemDetail}
        />
      )}
      <AlertDialog
        open={Boolean(pendingAttachmentRemoval)}
        onOpenChange={(open) => {
          if (!open) setPendingAttachmentRemoval(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAttachmentRemoval?.name ?? "This attachment"} will be
              removed from this client. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmAttachmentRemoval()}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove file
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={showMultipleInvoicesDialog}
        onOpenChange={(open) => {
          if (!open) deferMultipleInvoicesDecision();
        }}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">
              Does this closed lead have multiple invoices?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Choose whether this invoice should be tracked as part of multiple
              invoices for {client.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="block sm:block">
            <div className="grid grid-cols-2 gap-4">
              <AlertDialogAction
                onClick={() => setMultipleInvoices("Yes")}
                className="min-h-40 bg-amber-500 text-3xl font-bold text-white hover:bg-amber-600"
              >
                YES
              </AlertDialogAction>
              <AlertDialogAction
                onClick={() => setMultipleInvoices("No")}
                className="min-h-40 bg-slate-600 text-3xl font-bold text-white hover:bg-slate-700"
              >
                NO
              </AlertDialogAction>
            </div>
            <div className="mt-4 flex justify-center">
              <AlertDialogCancel
                onClick={deferMultipleInvoicesDecision}
                className="h-8 px-3 text-xs text-slate-600"
              >
                Decide later
              </AlertDialogCancel>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

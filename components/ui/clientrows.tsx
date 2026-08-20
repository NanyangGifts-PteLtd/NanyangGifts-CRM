// for rendering client rows
"use client";
/* eslint-disable @next/next/no-img-element */

import { Client, Subitem, ClientStatus, ReplyStatus, ActivityEntry, Profile } from "../../app/types";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Activity, Trash2, ReceiptText, FileBox, Paperclip, Plus, Link as LinkIcon, FileText, X } from "lucide-react";
import { EditableCell } from "./editablecell";
import { StatusBadge } from "./statusbadge";
import { SubitemsTable } from "./subitems";
import { AssigneeMultiSelect } from "./assignee-multiselect";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "../ui/alert-dialog";
import { Tooltip } from "radix-ui";
import type { CustomColumn } from '@/lib/custom-columns';
import { calculateSubitemFinancials } from '@/lib/subitem-calculations';

type OptionEntry = { value: string; color: string };
type AttachmentItem = {
    id: string;
    kind: "file" | "link";
    name: string;
    url: string;
    mimeType?: string;
};

export type ClientRowProps = {
    client: Client;
    isSelected: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onToggleSelect: () => void;
    onUpdate: (u: Partial<Client>) => void;
    onUpdateSubitem: (subitemId: string, u: Partial<Subitem>) => void;
    onAddSubitem: () => void;
    onDeleteSubitem: (id: string) => void;
    selectedSubitemIds: string[];
    onToggleSubitemSelection: (subitemId: string) => void;
    onToggleAllSubitems: (subitemIds: string[]) => void;
    onSubitemDragStart?: (subitemId: string, event: React.DragEvent<HTMLElement>) => void;
    onSubitemDragEnd?: () => void;
    onSubitemDragOver?: (event: React.DragEvent<HTMLDivElement>, clientId: string) => void;
    onSubitemDrop?: (event: React.DragEvent<HTMLDivElement>, clientId: string) => void;
    isSubitemDropTarget?: boolean;
    onDelete: () => void;
    onOpenOcfModal: (client: Client) => void;
    profiles: Profile[];
    clientAssignedIds: string[];
    onChangeClientAssignees: (ids: string[]) => void;
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
    onAddReplyStatus?: (name: string) => void | Promise<void>;
    onDeleteReplyStatus?: (name: string) => void | Promise<void>;
    onAddStatus?: (name: string) => void | Promise<void>;
    onDeleteStatus?: (name: string) => void | Promise<void>;
    onAddChannel?: (name: string) => void | Promise<void>;
    onDeleteChannel?: (name: string) => void | Promise<void>;
    onAddImportance?: (name: string) => void | Promise<void>;
    onDeleteImportance?: (name: string) => void | Promise<void>;
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
    onUpdateOptionColor?: (code: string, name: string, color: string) => void | Promise<void>;
    onRenameOption?: (code: string, oldName: string, newName: string) => void | Promise<void>;
    onFilterColumn?: (column: string) => void;
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
        value: string
    ) => void | Promise<void>;
    currentUserRole?: string | null;
    currentUserId?: string | null;
    onPushToShipperView?: (subitemId: string) => void | Promise<void>;
    onUndoActivity?: (entry: ActivityEntry) => void | Promise<void>;
    groupNamesById: Record<string, string>;


};

export function ClientRow({
    client,
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
    onSubitemDragOver,
    onSubitemDrop,
    isSubitemDropTarget,
    onDelete,
    onOpenOcfModal,
    profiles,
    clientAssignedIds,
    onChangeClientAssignees,
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
    onAddReplyStatus,
    onDeleteReplyStatus,
    onAddStatus,
    onDeleteStatus,
    onAddChannel,
    onDeleteChannel,
    onAddImportance,
    onDeleteImportance,
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
    onPushToShipperView
    , onUndoActivity
    , groupNamesById


}: ClientRowProps) {
    const subitemCount = client.subitems.length;
    const [showCloseDialog, setShowCloseDialog] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<ClientStatus | null>(null);
    const [closeFiles, setCloseFiles] = useState<File[]>([]);
    const [closeConfirmed, setCloseConfirmed] = useState(false);
    const [showActivityLog, setShowActivityLog] = useState(false);
    const [showOnlyAttachedActivities, setShowOnlyAttachedActivities] = useState(false);
    const [undoneActivityIds, setUndoneActivityIds] = useState<Set<string>>(new Set());
    const [attachmentDrafts, setAttachmentDrafts] = useState<Record<string, string>>({});
    const [attachmentSourceMenu, setAttachmentSourceMenu] = useState<string | null>(null);
    const [attachmentLinkDialog, setAttachmentLinkDialog] = useState<string | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);

    useEffect(() => {
        if (!attachmentSourceMenu) return;
        const handler = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('[data-attachment-menu-trigger], [data-attachment-menu]')) return;
            setAttachmentSourceMenu(null);
        };

        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
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
                if (Array.isArray(parsed)) return parsed.filter((item): item is AttachmentItem => Boolean(item && typeof item === "object" && "url" in item));
            } catch {
                if (rawValue) {
                    return [{ id: `legacy-${fieldKey}`, kind: /^https?:\/\//i.test(rawValue) ? "link" : "file", name: /^https?:\/\//i.test(rawValue) ? rawValue : "Attachment", url: rawValue }];
                }
            }
            return [];
        };

        const items = parseItems();
        const saveItems = (nextItems: AttachmentItem[]) => updateClientCustomField(client.id, fieldKey, JSON.stringify(nextItems));
        const addItem = (item: AttachmentItem) => {
            saveItems([...items, item]);
            setAttachmentSourceMenu(null);
            setAttachmentLinkDialog(null);
        };

        const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
            try {
                const nextItems = await Promise.all(Array.from(event.target.files ?? []).map(async (file) => {
                    const url = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result ?? ""));
                        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
                        reader.readAsDataURL(file);
                    });
                    return { id: crypto.randomUUID(), kind: "file" as const, name: file.name, url, mimeType: file.type };
                }));
                if (nextItems.length) saveItems([...items, ...nextItems]);
            } finally {
                event.target.value = "";
                setAttachmentSourceMenu(null);
            }
        };

        const isImage = (item: AttachmentItem) => item.mimeType?.startsWith("image/") || /^data:image\//i.test(item.url);
        const removeItem = (id: string) => saveItems(items.filter((item) => item.id !== id));

        return (
            <div className="group/attachment relative flex min-h-[34px] items-center gap-1 px-1 py-0.5">
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                    {items.map((item) => (
                        <div key={item.id} className="relative shrink-0" onMouseEnter={() => setAttachmentPreview(`${fieldKey}:${item.id}`)} onMouseLeave={() => setAttachmentPreview(null)}>
                            <a href={item.url} target="_blank" rel="noreferrer" title={item.name} className="flex h-7 w-8 items-center justify-center overflow-hidden rounded border border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-400">
                                {isImage(item) ? <img src={item.url} alt={item.name} className="h-full w-full object-cover" /> : item.kind === "link" ? <LinkIcon size={13} /> : <FileText size={13} />}
                            </a>
                            {attachmentPreview === `${fieldKey}:${item.id}` && (
                                <div className="pointer-events-none absolute bottom-full left-0 z-[100] mb-1 w-64 rounded-md border border-slate-200 bg-white p-2 shadow-xl">
                                    {isImage(item) ? (
                                        <img src={item.url} alt={item.name} className="block max-h-52 w-full object-contain" />
                                    ) : (
                                        <div className="flex items-center gap-2 p-2 text-[11px] text-slate-700"><FileText size={16} /> <span className="break-words">{item.name}</span></div>
                                    )}
                                </div>
                            )}
                            <button type="button" onClick={() => removeItem(item.id)} title="Remove attachment" className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[10px] text-slate-500 shadow group-hover/attachment:flex hover:text-red-500"><X size={9} /></button>
                        </div>
                    ))}
                </div>

                <button type="button" data-attachment-menu-trigger onClick={() => setAttachmentSourceMenu(attachmentSourceMenu === fieldKey ? null : fieldKey)} className="flex h-7 w-7 shrink-0 items-center justify-center gap-0.5 rounded text-slate-400 opacity-0 transition-opacity group-hover/attachment:opacity-100 hover:bg-sky-50 hover:text-sky-600" title="Add attachment"><Plus size={12} /><FileText size={14} /></button>
                {attachmentSourceMenu === fieldKey && (
                    <div data-attachment-menu className="absolute right-0 top-full z-[110] mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-xs text-slate-700 hover:bg-slate-50"><Paperclip size={14} /> From computer<input type="file" multiple className="hidden" onChange={handleFileChange} /></label>
                        <button type="button" onClick={() => { setAttachmentSourceMenu(null); setAttachmentLinkDialog(fieldKey); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"><LinkIcon size={14} /> From link</button>
                    </div>
                )}
                {attachmentLinkDialog === fieldKey && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-4" onMouseDown={() => setAttachmentLinkDialog(null)}>
                        <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
                            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium text-slate-800">Add link</h3><button type="button" onClick={() => setAttachmentLinkDialog(null)}><X size={16} /></button></div>
                            <input autoFocus value={draft} onChange={(event) => setAttachmentDrafts((previous) => ({ ...previous, [fieldKey]: event.target.value }))} placeholder="Paste a link" className="mb-3 h-9 w-full rounded border border-slate-200 px-2 text-sm outline-none focus:border-sky-400" />
                            <button type="button" disabled={!draft.trim()} onClick={() => addItem({ id: crypto.randomUUID(), kind: "link", name: draft.trim(), url: draft.trim() })} className="w-full rounded bg-sky-600 px-3 py-2 text-sm text-white disabled:opacity-50">Add link</button>
                        </div>
                    </div>
                )}
            </div>
        );
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

    const clientCreationActivity = client.activityLog?.find((entry) => entry.action === "client_added");
    const clientCreatedTooltip = client.createdAt
        ? `Created by ${clientCreationActivity?.actorName ?? "Unknown user"} on ${new Date(client.createdAt).toLocaleDateString("en-SG")} at ${new Date(client.createdAt).toLocaleTimeString("en-SG")}`
        : "";

    // activity log text
    function displayLogValue(value: unknown) {
        if (value == null || value === '') return 'empty';

        if (Array.isArray(value)) {
            return `${value.length} item(s)`;
        }

        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }

        return String(value);
    }

    function displayActivityValue(fieldName: string | undefined, value: unknown) {
        if (fieldName === 'groupId' && value) {
            return groupNamesById[String(value)] ?? String(value);
        }
        return displayLogValue(value);
    }
    function renderActivityText(entry: ActivityEntry) {
        if (entry.title || entry.description) {
            return (
                <>
                    {entry.title ? <span className="font-medium">{entry.title}</span> : null}
                    {entry.description ? (
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
                    <span className="text-gray-600">{displayActivityValue(entry.fieldName, entry.oldValue ?? "empty")}</span> to{" "}
                    <span className="text-gray-600">{displayActivityValue(entry.fieldName, entry.newValue ?? "empty")}</span>
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
                        changed subitem <span className="font-medium">{entry.subitemName ?? "Subitem"}</span>{" "}
                        timeline row <span className="font-medium">{rowName}</span>{" "}
                        field <span className="font-medium">{changedField}</span> from{" "}
                        <span className="text-gray-600">{displayLogValue(entry.oldValue)}</span> to{" "}
                        <span className="text-gray-600">{displayLogValue(entry.newValue)}</span>
                    </>
                );
            }

            return (
                <>
                    changed subitem <span className="font-medium">{entry.subitemName ?? "Subitem"}</span>{" "}
                    field <span className="font-medium">{entry.fieldName}</span> from{" "}
                    <span className="text-gray-600">{displayLogValue(entry.oldValue)}</span> to{" "}
                    <span className="text-gray-600">{displayLogValue(entry.newValue)}</span>
                </>
            );
        }

        return <>{entry.action ?? "activity recorded"}</>;
    }

    return (
        <div
            className={`mb-0 w-fit min-w-0 ${isSubitemDropTarget ? 'ring-2 ring-inset ring-[#0f8da8]' : ''}`}
            onDragOver={(event) => onSubitemDragOver?.(event, client.id)}
            onDrop={(event) => onSubitemDrop?.(event, client.id)}
        >
            <style>{Array.from(hiddenColumnKeys).filter((key) => key.startsWith('client:')).map((key) => `[data-client-column="${key.slice(7)}"]{display:none!important}`).join('')}</style>
            <div
                data-client-row
                data-client-id={client.id}
                style={{ width: boardWidth, minWidth: boardWidth }}
                className="box-border border-b flex text-[15px] items-center flex-shrink-0 border-r border-[#D0D4E4] group transition-colors"
            >
                <div
                    data-client-column="selectCheckbox"
                    className="box-border flex items-center min-w-0 px-3 flex-shrink-0 overflow-hidden"
                    style={{ minWidth: colWidth.selectCheckbox, width: colWidth.selectCheckbox, order: columnOrderMap.selectCheckbox ?? 0 }}
                >
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggleSelect}
                        disabled={selectedSubitemIds.length > 0}
                        title={selectedSubitemIds.length > 0 ? "Clients and subitems cannot be selected together" : "Select client"}
                        className={`w-3 h-3 rounded accent-[#7BCBD5] transition transform active:scale-150 duration-200 ${selectedSubitemIds.length > 0 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                    />
                    <button
                        onClick={onToggleExpand}
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                        {isExpanded ? (
                            <ChevronDown size={14} className="transition transform active:scale-150 duration-100" />
                        ) : (
                            <ChevronRight size={14} className="transition transform active:scale-150 duration-100" />
                        )}
                    </button>
                </div>

                <div
                    draggable
                    data-client-column="client"
                    onDragStart={(event) => onDragStart(event)}
                    onDragEnd={onDragEnd}
                    className={`box-border flex items-center min-w-0 px-1 border-r border-[#D0D4E4] overflow-hidden ${isDragging ? "opacity-40" : ""} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    style={{ height: 30, minWidth: colWidth.client, width: colWidth.client, order: columnOrderMap.client ?? 1 }}
                >

                    <div className="min-w-0 flex items-left">
                        <EditableCell
                            value={client.name}
                            onChange={(v) => onUpdate({ name: v })}
                            placeholder="Client name"
                            className="font-semibold text-gray-800"
                        />
                    </div>
                    <div className="ml-auto flex items-center justify-start gap-1 flex-shrink-0">
                        {subitemCount > 0 && (
                            <span className="text-[12.6px] text-[#7BCBD5] items-left justify-left bg-[#e7fdff] rounded-full px-1.5 py-0.5 flex-shrink-0">
                                {subitemCount}
                            </span>
                        )}
                        <Tooltip.Provider>
                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => setShowActivityLog(true)}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        className="flex whitespace-nowrap px-2 py-1 text-[10px] font-medium text-cyan-500 hover:bg-gray-50 hover:text-cyan-600 transition transform active:scale-95 duration-150"
                                    >
                                        <Activity size={10} className="transition transform active:scale-150 duration-200" />
                                    </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent">
                                        View activity log<Tooltip.Arrow className="TooltipArrow" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>
                        </Tooltip.Provider>
                        {showActivityLog && (
                            <div
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
                                            <h2 className="text-sm font-semibold text-gray-900">Activity Log</h2>
                                            <p className="text-[12.6px] text-gray-500">{client.name}</p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowOnlyAttachedActivities((previous) => !previous)}
                                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${showOnlyAttachedActivities
                                                    ? 'border-teal-300 bg-teal-100 text-teal-700'
                                                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                                                    }`}
                                                title="Filter to activities with an attached file"
                                                aria-pressed={showOnlyAttachedActivities}
                                            >
                                                <FileBox size={13} />
                                                {showOnlyAttachedActivities ? 'Attached files' : 'All activities'}
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
                                                .filter((entry) => !entry.subitemId || entry.action === 'subitem_added' || entry.action === 'subitem_deleted')
                                                .filter((entry) => !showOnlyAttachedActivities || Boolean(entry.link))
                                                .sort(
                                                    (a, b) =>
                                                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                                                );

                                            if (clientActivities.length === 0) {
                                                return (
                                            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                                                {showOnlyAttachedActivities ? 'No activities with attached files yet.' : 'No activity yet.'}
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
                                                                            <span className="font-medium">{entry.actorName}</span>{" "}
                                                                        </>
                                                                    ) : null}
                                                                    {renderActivityText(entry)}
                                                                    {entry.link ? (
                                                                        <a
                                                                            href={entry.link}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="ml-4 inline-flex items-center rounded-md bg-teal-100 px-2 py-1 text-[12.6px] font-medium text-teal-500 hover:bg-teal-200"
                                                                        >
                                                                            Open OCF
                                                                        </a>
                                                                    ) : null}
                                                                </p>
                                                                <p className="mt-1 text-[12.6px] text-gray-500">
                                                                    {new Date(entry.createdAt).toLocaleString()}
                                                                </p>
                                                            </div>
                                                            {(entry.action === 'field_changed' || entry.action === 'subitem_field_changed') && entry.oldValue !== undefined && entry.oldValue !== null && (
                                                                <button
                                                                    type="button"
                                                                    disabled={undoneActivityIds.has(entry.id)}
                                                                    onClick={async () => {
                                                                        if (undoneActivityIds.has(entry.id)) return;
                                                                        await onUndoActivity?.(entry);
                                                                        setUndoneActivityIds((previous) => new Set(previous).add(entry.id));
                                                                    }}
                                                                    title={undoneActivityIds.has(entry.id) ? 'The action has already been undone' : 'Undo this action'}
                                                                    className="shrink-0 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    {undoneActivityIds.has(entry.id) ? 'Undone' : 'Undo'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}
                        <Tooltip.Provider>
                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <button
                                        type="button"
                                        className="px-2 py-2 text-[10px] font-medium text-teal-500"
                                        aria-label="Generate estimate placeholder"
                                    >
                                        <ReceiptText size={15} color="#7BCBD5" className="transition transform active:scale-150 duration-200" />
                                    </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent">Generate estimate<Tooltip.Arrow className="TooltipArrow" /></Tooltip.Content>

                                </Tooltip.Portal>
                            </Tooltip.Root>
                        </Tooltip.Provider>
                        <Tooltip.Provider>
                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <button
                                        onClick={() => onOpenOcfModal(client)}
                                        className="px-2 py-2 text-[10px] font-medium text-teal-500"
                                    > <FileBox size={15} color="#7BCBD5" className="transition transform active:scale-150 duration-200" /></button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent">Generate Order Confirmation Form<Tooltip.Arrow className="TooltipArrow" /></Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>
                        </Tooltip.Provider>
                    </div>
                </div>
                <div
                    data-client-column="people"
                    className="flex-1 min-w-0 py-1 overflow-hidden whitespace-nowrap text-ellipsis border-r border-[#D0D4E4]"
                    style={{ minWidth: colWidth.people, width: colWidth.people, order: columnOrderMap.people ?? 2 }}
                >
                    <AssigneeMultiSelect
                        profiles={profiles}
                        selectedIds={clientAssignedIds}
                        onChange={onChangeClientAssignees}
                    />
                </div>

                <div
                    data-client-column="replyStatus"
                    className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] transition transform active:scale-95 duration-150"
                    style={{ minWidth: colWidth.replyStatus, width: colWidth.replyStatus, order: columnOrderMap.replyStatus ?? 3 }}
                >
                    <StatusBadge
                        value={client.replyStatus}
                        onChange={(v) => onUpdate({ replyStatus: v as ReplyStatus })}
                        options={replyStatusOptions}
                        onAddOption={onAddReplyStatus}
                        onDeleteOption={onDeleteReplyStatus}
                        manageLabel="reply status"
                        onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('reply_status', name, color)}
                        onRenameOption={(oldName, newName) => onRenameOption?.('reply_status', oldName, newName)}
                    />
                </div>

                <div
                    data-client-column="followUp"
                    className="flex-1 min-w-0 py-1 overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-1 border-[#D0D4E4] transition transform active:scale-95 duration-150"
                    style={{ minWidth: colWidth.followUp, width: colWidth.followUp, order: columnOrderMap.followUp ?? 4 }}
                >
                    <input
                        type="date"
                        value={toDateInputValue(client.followUp)}
                        onChange={(e) => onUpdate({ followUp: e.target.value })}
                        className="text-[12.6px] px-1 border-none outline-none bg-transparent cursor-pointer w-full"
                    />
                </div>

                <div
                    data-client-column="status"
                    className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150"
                    style={{ minWidth: colWidth.status, width: colWidth.status, order: columnOrderMap.status ?? 5 }}
                >
                    <StatusBadge
                        value={client.status}
                        onChange={(v) => {
                            const nextStatus = v as ClientStatus;

                            if (nextStatus === "Closed") {
                                setPendingStatus(nextStatus);
                                setCloseFiles([]);
                                setCloseConfirmed(false);
                                setShowCloseDialog(true);
                                return;
                            }

                            onUpdate({ status: nextStatus });
                        }}
                        options={statusOptions}
                        onAddOption={onAddStatus}
                        onDeleteOption={onDeleteStatus}
                        manageLabel="status"
                        onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('client_status', name, color)}
                        onRenameOption={(oldName, newName) => onRenameOption?.('client_status', oldName, newName)}
                    />

                    <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Close this client?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Please upload the required files and confirm before marking this client as Closed.
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <div className="space-y-4 py-2">
                                <div>
                                    <label className="text-sm font-medium">Upload purchase order</label>
                                    <input
                                        type="file"
                                        multiple
                                        className="file:rounded-md file:border-0 file:font-semibold file:bg-[#7BCBD5] file:text-[#ffffff] hover:file:bg-[#6db6bf] file:mr-4 mt-2 block text-sm transition transform active:scale-95 duration-150"
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            setCloseFiles(files);
                                        }}
                                    />
                                    <br />
                                    <label className="text-sm font-medium">Upload signed quotation</label>
                                    <input
                                        type="file"
                                        multiple
                                        className="file:rounded-md file:border-0 file:font-semibold file:bg-[#7BCBD5] file:text-[#ffffff] hover:file:bg-[#6db6bf] file:mr-4 mt-2 block text-sm transition transform active:scale-95 duration-150"
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            setCloseFiles(files);
                                        }}
                                    />
                                    <br />
                                    <label className="text-sm font-medium">Upload proof of payment</label>
                                    <input
                                        type="file"
                                        multiple
                                        className="file:rounded-md file:border-0 file:font-semibold file:bg-[#7BCBD5] file:text-[#ffffff] hover:file:bg-[#6db6bf] file:mr-4 mt-2 block text-sm transition transform active:scale-95 duration-150"
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            setCloseFiles(files);
                                        }}
                                    />
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
                                        if (!closeFiles.length || !closeConfirmed || pendingStatus !== "Closed") {
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
                    style={{ minWidth: colWidth.channel, width: colWidth.channel, order: columnOrderMap.channel ?? 6 }}
                >
                    <StatusBadge
                        value={client.channel}
                        onChange={(v) => onUpdate({ channel: v })}
                        options={channelOptions}
                        onAddOption={onAddChannel}
                        onDeleteOption={onDeleteChannel}
                        manageLabel="channel"
                        onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('channel', name, color)}
                        onRenameOption={(oldName, newName) => onRenameOption?.('channel', oldName, newName)}
                    />
                </div>

                <div
                    data-client-column="importance"
                    className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150"
                    style={{ minWidth: colWidth.importance, width: colWidth.importance, order: columnOrderMap.importance ?? 7 }}
                >
                    <StatusBadge
                        value={client.importance}
                        onChange={(v) => onUpdate({ importance: v })}
                        options={importanceOptions}
                        onAddOption={onAddImportance}
                        onDeleteOption={onDeleteImportance}
                        manageLabel="importance"
                        onUpdateOptionColor={(name, color) => onUpdateOptionColor?.('importance', name, color)}
                        onRenameOption={(oldName, newName) => onRenameOption?.('importance', oldName, newName)}
                    />
                </div>

                <div data-client-column="company" className="min-w-0 py-1 w-full overflow-hidden border-r border-[#D0D4E4] whitespace-nowrap text-ellipsis" style={{ height: 30, minWidth: colWidth.company, width: colWidth.company, order: columnOrderMap.company ?? 8 }}>
                    <EditableCell className="!justify-start px-1" value={client.company} onChange={(v) => onUpdate({ company: v })} placeholder="" />
                </div>

                <div data-client-column="email" className="flex-1 min-w-0 items-center py-1 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis text-blue-600" style={{ height: 30, minWidth: colWidth.email, width: colWidth.email, order: columnOrderMap.email ?? 9 }}>
                    <EditableCell className="!justify-start px-1 text-blue-600" value={client.email} onChange={(v) => onUpdate({ email: v })} placeholder="" />
                </div>

                <div data-client-column="phone" className="flex-1 min-w-0 py-1 items-center border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis text-blue-600" style={{ height: 30, minWidth: colWidth.phone, width: colWidth.phone, order: columnOrderMap.phone ?? 10 }}>
                    <EditableCell className="text-blue-600" value={client.phone} onChange={(v) => onUpdate({ phone: v })} placeholder="" />
                </div>

                <div data-client-column="requirements" className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height: 30, minWidth: colWidth.requirements, width: colWidth.requirements, order: columnOrderMap.requirements ?? 11 }}>
                    <EditableCell className="!justify-start px-1" value={client.requirements} onChange={(v) => onUpdate({ requirements: v })} placeholder="" />
                </div>
                <div
                    data-client-column="nbd"
                    className="flex items-center border-r border-[#D0D4E4] transition transform active:scale-95 duration-150" style={{ height: 30, minWidth: colWidth.nbd, width: colWidth.nbd, order: columnOrderMap.nbd ?? 12 }}>
                    <input
                        type="date"
                        value={toDateInputValue(client.nbd)}
                        onChange={(e) => onUpdate({ nbd: e.target.value })}
                        className="text-[12.6px] border-none outline-none bg-transparent cursor-pointer w-full"
                    />
                </div>
                <div data-client-column="logoRequirementsFile" className="flex-1 min-w-0 border-r border-[#D0D4E4] overflow-visible bg-white" style={{ height: 30, minWidth: colWidth.logoRequirementsFile, width: colWidth.logoRequirementsFile, order: columnOrderMap.logoRequirementsFile ?? 13 }}>
                    {renderAttachmentField('logoRequirementsFile')}
                </div>
                <div data-client-column="filesMiscellaneous" className="flex-1 min-w-0 border-r border-[#D0D4E4] overflow-visible bg-white" style={{ height: 30, minWidth: colWidth.filesMiscellaneous, width: colWidth.filesMiscellaneous, order: columnOrderMap.filesMiscellaneous ?? 14 }}>
                    {renderAttachmentField('filesMiscellaneous')}
                </div>
                <div data-client-column="totalPrice" className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height: 30, minWidth: colWidth.totalPrice, width: colWidth.totalPrice, order: columnOrderMap.totalPrice ?? 15 }}>
                    <span className="block px-2 text-center text-[12.6px] text-gray-800">{aggregateSubitemValues.totalPrice.toFixed(2)}</span>
                </div>
                <div data-client-column="totalMarkup" className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height: 30, minWidth: colWidth.totalMarkup, width: colWidth.totalMarkup, order: columnOrderMap.totalMarkup ?? 16 }}>
                    <span className="block px-2 text-center text-[12.6px] text-gray-800">{aggregateSubitemValues.totalMarkup.toFixed(2)}</span>
                </div>
                <div data-client-column="companyAddress" className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height: 30, minWidth: colWidth.companyAddress, width: colWidth.companyAddress, order: columnOrderMap.companyAddress ?? 17 }}>
                    <EditableCell
                        value={client.companyAddress}
                        onChange={(v) => onUpdate({ companyAddress: v })}
                        className="!justify-start px-1"
                    />
                </div>

                <div data-client-column="billingAddress" className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height: 30, minWidth: colWidth.billingAddress, width: colWidth.billingAddress, order: columnOrderMap.billingAddress ?? 18 }}>
                    <EditableCell
                        value={client.billingAddress}
                        onChange={(v) => onUpdate({ billingAddress: v })}
                        className="!justify-start px-1"
                    />
                </div>

                <div data-client-column="dateCreated" className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height: 30, minWidth: colWidth.dateCreated, width: colWidth.dateCreated, order: columnOrderMap.dateCreated ?? 19 }}>
                    <span title={clientCreatedTooltip} className="block px-1 text-[12.6px] text-gray-700">
                        {client.createdAt ? new Date(client.createdAt).toLocaleDateString("en-SG") : "-"}
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
                                value={toDateInputValue(String(client.customFields?.[col.id] ?? ""))}
                                onChange={(e) =>
                                    updateClientCustomField(client.id, col.id, e.target.value)
                                }
                                className="text-[12.6px] border-none outline-none bg-transparent cursor-pointer w-full px-1"
                            />
                        ) : (
                            <EditableCell
                                value={String(client.customFields?.[col.id] ?? "")}
                                onChange={(v) =>
                                    updateClientCustomField(client.id, col.id, String(v))
                                }
                                type={col.field_type}
                                placeholder="—"
                            />
                        )}
                    </div>
                ))}
                <div
                    className="flex-shrink-0 border-r border-[#D0D4E4]"
                    style={{
                        height: 30,
                        minWidth: colWidth.addClientCol ?? 44,
                        width: colWidth.addClientCol ?? 44,
                        order: columnOrderMap.addClientCol ?? 999,
                    }}
/>
                {/* delete button */}
                <div className="flex items-center flex-shrink-0" style={{ minWidth: colWidth.empty, width: colWidth.empty, order: columnOrderMap.empty ?? 1000 }}>
                    <button
                        onClick={onDelete}
                        title="Delete client"
                        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
                

            </div>

            {isExpanded && (
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
                    profiles={profiles}
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
                    hiddenColumnKeys={hiddenColumnKeys}
                    onHideColumn={onHideColumn}
                    onSetColumnVisibility={onSetColumnVisibility}
                    onPushToShipperView={onPushToShipperView}
                    clientActivityLog={client.activityLog ?? []}
                    onUndoActivity={onUndoActivity}


                />
            )}
        </div>
    );
}

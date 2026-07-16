// for rendering client rows
"use client";

import { Client, Subitem, ClientStatus, ReplyStatus, ActivityEntry, Profile } from "../../app/types";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Activity, Trash2, ReceiptText, FileBox } from "lucide-react";
import { EditableCell } from "./editablecell";
import { StatusBadge } from "./statusbadge";
import { SubitemsTable } from "./subitems";
import { AssigneeMultiSelect } from "./assignee-multiselect";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "../ui/alert-dialog";
import { useGenerateEstimate } from '../hooks/use-generate-estimate-button';
import { Tooltip } from "radix-ui";

export const CLIENT_STATUSES: ClientStatus[] = [
    "New Lead",
    "Contacted",
    "Quoted",
    "Failed",
    "Overdue",
    "Follow Up",
    "Shortlisted",
    "Project Started",
    "Project Done",
    "Closed",
    "Unqualified",
];

export const REPLY_STATUSES: ReplyStatus[] = ["Waiting...", "Replied"];

export const REPLY_STATUS_COLORS: Record<string, string> = {
    "Waiting...": "#b9f7e0",
    "Replied": "#00cdb6",
};

export const STATUS_COLORS: Record<string, string> = {
    "New Lead": "#7ae9f0",
    "Contacted": "#5accf3",
    "Quoted": "#67aaea",
    "Failed": "#d4102d",
    "Overdue": "#a13762",
    "Follow Up": "#9D4393",
    Shortlisted: "#a159cf",
    "Project Started": "#a05d9f",
    "Project Done": "#dcb0ff",
    "Closed": "#0D1821",
    "Unqualified": "#8985ce",
};

export const IMPORTANCE_COLORS: Record<string, string> = {
    "High": "#ff6f9c",
    "Medium": "#ff99b6",
    "Low": "#ffd0e4",
};

export const CHANNEL_COLORS: Record<string, string> = {
    "Forms": "#82E1C2",
    "Email": "#70b5f6",
    "Referral": "#0085c8",
    "Direct": "#1eadd1",
    "Whatsapp": "#67e284",
    "E-comm": "#1cdcbc",
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
    onDelete: () => void;
    onOpenOcfModal: (client: Client) => void;
    profiles: Profile[];
    clientAssignedIds: string[];
    onChangeClientAssignees: (ids: string[]) => void;
    subitemAssigneeMap: Record<string, string[]>;
    onChangeSubitemAssignees: (subitemId: string, ids: string[]) => void;
    colWidth: Record<string, number>;
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
    onDelete,
    onOpenOcfModal,
    profiles,
    clientAssignedIds,
    onChangeClientAssignees,
    subitemAssigneeMap,
    onChangeSubitemAssignees,
    colWidth
}: ClientRowProps) {
    const importanceOpts = ["High", "Medium", "Low"];
    const channelOpts = ["Forms", "Email", "Referral", "Whatsapp", "E-comm", "Direct"];
    const subitemCount = client.subitems.length;
    const [showCloseDialog, setShowCloseDialog] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<ClientStatus | null>(null);
    const [closeFiles, setCloseFiles] = useState<File[]>([]);
    const [closeConfirmed, setCloseConfirmed] = useState(false);
    const [showActivityLog, setShowActivityLog] = useState(false);
    const {
        handleGenerateEstimate,
        isGeneratingEstimate,
        estimateError,
        estimateSuccess,
    } = useGenerateEstimate();
    
    // for estimate success message
    const [showEstimateSuccess, setShowEstimateSuccess] = useState(false);
    const [fadeEstimateSuccess, setFadeEstimateSuccess] = useState(false);

    useEffect(() => {
        if (!estimateSuccess) return;

        setShowEstimateSuccess(true);
        setFadeEstimateSuccess(false);

        const fadeTimer = setTimeout(() => {
            setShowEstimateSuccess(false);
            setFadeEstimateSuccess(false);
        }, 2000);

        const hideTimer = setTimeout(() => {
            setShowEstimateSuccess(false);
            setFadeEstimateSuccess(false);
        })

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(hideTimer);
        };
    }, [estimateSuccess])

    // for activity log text
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
                    <span className="text-gray-600">{displayLogValue(entry.oldValue ?? "empty")}</span> to{" "}
                    <span className="text-gray-600">{displayLogValue(entry.newValue ?? "empty")}</span>
                </>
            );
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
        <div className="mb-0">
            <div
                className={`box-border border-b flex items-center flex-shrink-0 border-r border-[#D0D4E4] hover:blue-50 group transition-colors ${isSelected ? "bg-blue-50" : ""
                    }`}
            >
                <div
                    className="box-border flex items-center min-w-0 px-3 flex-shrink-0 overflow-hidden"
                    style={{ minWidth: colWidth.selectCheckbox, width: colWidth.selectCheckbox }}
                >
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggleSelect}
                        className="w-3 h-3 rounded cursor-pointer accent-[#7BCBD5] transition transform active:scale-150 duration-200"
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
                    className="box-border flex items-center min-w-0 px-1 border-r border-[#D0D4E4] overflow-hidden"
                    style={{ height: 32, minWidth: colWidth.client, width: colWidth.client }}
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
                        <span className="text-xs text-[#7BCBD5] items-left justify-left bg-[#e7fdff] rounded-full px-1.5 py-0.5 flex-shrink-0">
                            {subitemCount}
                        </span>
                    )}
                    <Tooltip.Provider>
                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <button
                                    type="button"
                                    onClick={() => setShowActivityLog(true)}
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
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                            <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl">
                                <div className="mb-4 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-sm font-semibold text-gray-900">Activity Log</h2>
                                        <p className="text-xs text-gray-500">{client.name}</p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowActivityLog(false)}
                                        className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                        Close
                                    </button>
                                </div>
                                <div className="max-h-[420px] space-y-3 overflow-y-auto">
                                    {(client.activityLog?.length ?? 0) === 0 ? (
                                        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                                            No activity yet.
                                        </div>
                                    ) : (
                                        [...(client.activityLog ?? [])]
                                            .sort(
                                                (a, b) =>
                                                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                                            )
                                            .map((entry) => (
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
                                                                    className="ml-4 inline-flex items-center rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-500 hover:bg-teal-200"
                                                                >
                                                                    Open OCF
                                                                </a>
                                                                ) : null}
                                                            </p>
                                                            <p className="mt-1 text-xs text-gray-500">
                                                                {new Date(entry.createdAt).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <Tooltip.Provider>
                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <button
                                    onClick={() => handleGenerateEstimate(client.id)}
                                    disabled={isGeneratingEstimate}
                                    className="px-2 py-2 text-[10px] font-medium text-teal-500"
                                >
                                    {isGeneratingEstimate ? 'Generating...' : ''}<ReceiptText size={15} color="#7BCBD5" className="transition transform active:scale-150 duration-200" />
                                </button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className="TooltipContent">Generate estimate<Tooltip.Arrow className="TooltipArrow" /></Tooltip.Content>

                            </Tooltip.Portal>
                        </Tooltip.Root>
                    </Tooltip.Provider>
                    {estimateError && (
                        <div className="mt-1 text-[11px] text-red-600">{estimateError}</div>
                    )}
                    {showEstimateSuccess && (
                        <div className={`mt-1 text-[11px] text-teal-500 transition-opacity duration-500 ${fadeEstimateSuccess ? "opacity-0" : "opacity-100"}`}>Successfully generated!</div>
                    )}
                    <Tooltip.Provider>
                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <button
                                    onClick={() => onOpenOcfModal(client)}
                                    className="px-2 py-2 text-[10px] font-medium text-teal-500"
                                > <FileBox size={15} color="#7BCBD5" className= "transition transform active:scale-150 duration-200" /></button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className="TooltipContent">Generate Order Confirmation Form<Tooltip.Arrow className="TooltipArrow" /></Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>
                    </Tooltip.Provider>
                </div>
                </div>
                <div
                    className="flex-1 min-w-0 py-1 overflow-hidden whitespace-nowrap text-ellipsis border-r border-[#D0D4E4]"
                    style={{ minWidth: colWidth.people, width: colWidth.people }}
                >
                    <AssigneeMultiSelect
                        profiles={profiles}
                        selectedIds={clientAssignedIds}
                        onChange={onChangeClientAssignees}
                    />
                </div>

                <div
                    className="flex-1 min-w-0 py-1 overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] transition transform active:scale-95 duration-150"
                    style={{ minWidth: colWidth.replyStatus, width: colWidth.replyStatus }}
                >
                    <StatusBadge
                        value={client.replyStatus}
                        onChange={(v) => onUpdate({ replyStatus: v as ReplyStatus })}
                        options={REPLY_STATUSES}
                        colorMap={REPLY_STATUS_COLORS}
                    />
                </div>

                <div
                    className="flex-1 min-w-0 py-1 overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-1 border-[#D0D4E4] transition transform active:scale-95 duration-150"
                    style={{ minWidth: colWidth.followUp, width: colWidth.followUp }}
                >
                    <input
                        type="date"
                        value={client.followUp}
                        onChange={(e) => onUpdate({ followUp: e.target.value })}
                        className="text-xs border-none outline-none bg-transparent cursor-pointer w-full"
                    />
                </div>

                <div
                    className="flex-1 min-w-0 py-1 overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] flex-shrink-0 transition transform active:scale-95 duration-150"
                    style={{ minWidth: colWidth.status, width: colWidth.status }}
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
                        options={CLIENT_STATUSES}
                        colorMap={STATUS_COLORS}
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
                                        <div className="mt-2 text-xs text-gray-500 font-semibold">
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
                    className="flex-1 min-w-0 items-center py-1 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap !text-center text-ellipsis flex-shrink-0 transition transform active:scale-95 duration-150"
                    style={{ minWidth: colWidth.channel, width: colWidth.channel }}
                >
                    <StatusBadge
                        value={client.channel}
                        onChange={(v) => onUpdate({ channel: v })}
                        options={channelOpts}
                        colorMap={CHANNEL_COLORS}
                        small
                    />
                </div>

                <div
                    className="flex-1 min-w-0  py-1 items-center border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis !text-center flex-shrink-0 transition transform active:scale-95 duration-150"
                    style={{ minWidth: colWidth.importance, width: colWidth.importance }}
                >
                    <StatusBadge
                        value={client.importance}
                        onChange={(v) => onUpdate({ importance: v })}
                        options={importanceOpts}
                        colorMap={IMPORTANCE_COLORS}
                        small
                    />
                </div>

                <div className="min-w-0 py-1 w-full overflow-hidden border-r border-[#D0D4E4] whitespace-nowrap text-ellipsis" style={{ height: 32, minWidth: colWidth.company, width: colWidth.company }}>
                    <EditableCell value={client.company} onChange={(v) => onUpdate({ company: v })} placeholder="" />
                </div>

                <div className="flex-1 min-w-0 items-center py-1 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height: 32, minWidth: colWidth.email, width: colWidth.email }}>
                    <EditableCell value={client.email} onChange={(v) => onUpdate({ email: v })} placeholder="" />
                </div>

                <div className="flex-1 min-w-0 py-1 items-center border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height: 32, minWidth: colWidth.phone, width: colWidth.phone }}>
                    <EditableCell value={client.phone} onChange={(v) => onUpdate({ phone: v })} placeholder="" />
                </div>

                <div className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height: 32,  minWidth: colWidth.requirements, width: colWidth.requirements }}>
                    <EditableCell
                        value={client.requirements}
                        onChange={(v) => onUpdate({ requirements: v })}
                        placeholder=""
                    />
                </div>
                <div
                    className="flex items-center border-r border-[#D0D4E4] transition transform active:scale-95 duration-150" style={{ height:32, minWidth: colWidth.nbd, width: colWidth.nbd }}>
                    <input
                        type="date"
                        value={client.nbd}
                        onChange={(e) => onUpdate({ nbd: e.target.value })}
                        className="text-xs border-none outline-none bg-transparent cursor-pointer w-full"
                    />
                </div>
                <div className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height: 32, minWidth: colWidth.totalPrice, width: colWidth.totalPrice }}>
                    <EditableCell className="!px-8" value={client.totalPrice} onChange={(v) => onUpdate({ totalPrice: v })} type="Number"/>
                </div>
                <div className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height:32, minWidth: colWidth.companyAddress, width: colWidth.companyAddress }}>
                    <EditableCell
                        value={client.companyAddress}
                        onChange={(v) => onUpdate({ companyAddress: v })}
                    />
                </div>

                <div className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height:32, minWidth: colWidth.billingAddress, width: colWidth.billingAddress }}>
                    <EditableCell
                        value={client.billingAddress}
                        onChange={(v) => onUpdate({ billingAddress: v })}
                    />
                </div>

                <div className="flex-1 min-w-0 py-1.5 border-r border-[#D0D4E4] overflow-hidden whitespace-nowrap text-ellipsis" style={{ height:32, minWidth: colWidth.dateCreated, width: colWidth.dateCreated }}>
                    <EditableCell value={client.dateCreated} onChange={(v) => onUpdate({ dateCreated: v })} />
                </div>

                <div className="flex items-center flex-shrink-0" style={{ minWidth: colWidth.empty, width: colWidth.empty }}>
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
                    profiles={profiles}
                    subitemAssigneeMap={subitemAssigneeMap}
                    onChangeSubitemAssignees={onChangeSubitemAssignees}
                />
            )}
        </div>
    );
}
"use client";
import { Client, Subitem, ClientStatus, ReplyStatus, ActivityEntry, TimelineRow } from "../../app/types";
import { useState } from "react";
import { ChevronDown, ChevronRight, Activity, Plus, Trash2 } from "lucide-react";
import { EditableCell } from "./editablecell";
import { StatusBadge } from "./statusbadge";
import { SubitemsTable } from "./subitems";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger } from '../ui/alert-dialog';

export const CLIENT_STATUSES: ClientStatus[] = [
    'New Lead', 'Contacted', 'Quoted', 'Failed', 'Overdue',
    'Follow Up', 'Shortlisted', 'Project Started', 'Project Done', 'Closed', 'Unqualified',
];

export const REPLY_STATUSES: ReplyStatus[] = [
    'Waiting...', 'Replied'
];

export const REPLY_STATUS_COLORS: Record<string, string> = {
    'Waiting...': '#b9f7e0',
    'Replied': '#00cdb6'
};

export const STATUS_COLORS: Record<string, string> = {
    'New Lead': '#7ae9f0',
    'Contacted': '#5accf3',
    'Quoted': '#67aaea',
    'Failed': '#d4102d',
    'Overdue': '#a13762',
    'Follow Up': '#9D4393',
    'Shortlisted': '#a159cf',
    'Project Started': '#a05d9f',
    'Project Done': '#dcb0ff',
    'Closed': '#0D1821',
    'Unqualified': '#8985ce',
};

export const IMPORTANCE_COLORS: Record<string, string> = {
    'High': '#ff6f9c',
    'Medium': '#ff99b6',
    'Low': '#ffd0e4'
};

export const CHANNEL_COLORS: Record<string, string> = {
    'Forms': '#82E1C2',
    'Email': '#70b5f6',
    'Referral': '#0085c8',
    'Direct': '#1eadd1',
    'Whatsapp': '#67e284',
    'E-comm': '#1cdcbc'
};


export function ClientRow({
    client, isSelected, onToggleSelect, onUpdate, onUpdateSubitem,
    onAddSubitem, onDeleteSubitem, onDelete,
}: {
    client: Client;
    isSelected: boolean;
    onToggleSelect: () => void;
    onUpdate: (u: Partial<Client>) => void;
    onUpdateSubitem: (subitemId: string, u: Partial<Subitem>) => void;
    onAddSubitem: () => void;
    onDeleteSubitem: (id: string) => void;
    onDelete: () => void;
}) {
    const importanceOpts = ['High', 'Medium', 'Low'];
    const channelOpts = ['Forms', 'Email', 'Referral', 'Whatsapp', 'E-comm', 'Direct'];
    const subitemCount = client.subitems.length;
    const [showCloseDialog, setShowCloseDialog] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<ClientStatus | null>(null);
    const [closeFiles, setCloseFiles] = useState<File[]>([]);
    const [closeConfirmed, setCloseConfirmed] = useState(false);

    const [showActivityLog, setShowActivityLog] = useState(false);

    function renderActivityText(entry: ActivityEntry) {
        if (entry.action === "field_changed") {
            return (
                <>
                    changed <span className="font-medium">{entry.fieldName}</span> from{" "}
                    <span className="text-gray-600">
                        {String(entry.oldValue ?? "empty")}
                    </span>{" "}
                    to{" "}
                    <span className="text-gray-600">
                        {String(entry.newValue ?? "empty")}
                    </span>
                </>
            );
        }

        if (entry.action === "subitem_added") {
            return <>added a subitem</>;
        }

        if (entry.action === "subitem_deleted") {
            return <>deleted a subitem</>;
        }

        return <>{entry.action}</>;
    }

    return (
        <div className="mbs-3">
            <div className={`flex items-stretch border-b border-gray-100 hover:bg-gray-50 group transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>

                {/* Checkbox + expand */}
                <div className="flex items-center px-2 gap-1.5 flex-shrink-0 border-r border-gray-200" style={{ minWidth: 60, width: 60 }}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggleSelect}
                        className="w-3 h-3 rounded cursor-pointer accent-[#7BCBD5]"
                    />
                    <button
                        onClick={() => onUpdate({ expanded: !client.expanded })}
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                        {client.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                </div>

                {/* Client name */}
                <div className="flex items-center gap-1.5 px-1 py-2 border-r border-gray-200 flex-shrink-0" style={{ height: 30, minWidth: 180, width: 100 }}>

                    <EditableCell
                        value={client.name}
                        onChange={v => onUpdate({ name: v })}
                        placeholder="Client name"
                        className="font-semibold text-gray-800"
                    />
                    {subitemCount > 0 && (
                        <span className="text-xs text-[#7BCBD5] bg-[#e7fdff] rounded-full px-1.5 py-0.5 flex-shrink-0">{subitemCount}</span>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowActivityLog(true)}
                        className="px-2 py-1 text-[10px] font-medium text-cyan-500 hover:bg-gray-50 hover:text-cyan-600 transition transform active:scale-95 duration-150"
                    > <Activity size={10} /> </button>
                    {showActivityLog && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                            <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl">
                                <div className="mb-4 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-sm font-semibold text-gray-900">
                                            Activity Log
                                        </h2>
                                        <p className="text-xs text-gray-500">
                                            {client.name}
                                        </p>
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
                                                                <span className="font-medium">{entry.actorName}</span>{" "}
                                                                {renderActivityText(entry)}
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
                </div>

                {/* People */}
                <div className="flex items-center px-2 border-r border-gray-200 flex-shrink-0" style={{ minWidth: 70, width: 70 }}>
                    {client.people ? (
                        <div className="flex gap-0.5 flex-wrap">
                            {client.people.split(' ').map((p, i) => (
                                <div key={i} className="w-6 h-6 rounded-sm flex items-center justify-center text-white text-xs font-bold"
                                    style={{ background: ['#845ec2', '#2c73d2', '#0081cf', '#0089ba'][i % 4] }}>
                                    {p[0]}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded-sm border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-blue-400">
                            <Plus size={9} className="text-gray-400" />
                        </div>
                    )}
                </div>

                {/* Reply Status */}
                <div className="flex items-center px-2 border-r border-gray-200 transition transform active:scale-95 duration-150" style={{ minWidth: 90, width: 90 }}>
                    <StatusBadge
                        value={client.replyStatus}
                        onChange={v => onUpdate({ replyStatus: v as ReplyStatus })}
                        options={REPLY_STATUSES}
                        colorMap={REPLY_STATUS_COLORS}
                    />
                </div>

                {/* Follow Up */}
                <div className="flex items-center px-2 border-r border-gray-200 transition transform active:scale-95 duration-150" style={{ minWidth: 100, width: 100 }}>
                    <input type="date" value={client.followUp} onChange={e => onUpdate({ followUp: e.target.value })}
                        className="text-xs border-none outline-none bg-transparent cursor-pointer w-full" />
                </div>

                {/* Status */}
                <div className="flex items-center px-2 border-r border-gray-200 flex-shrink-0 transition transform active:scale-95 duration-150" style={{ minWidth: 115, width: 115 }}>
                    <StatusBadge
                        value={client.status}
                        onChange={(v) => {
                            const nextStatus = v as ClientStatus;

                            if (nextStatus == "Closed") {
                                setPendingStatus(nextStatus);
                                setCloseFiles([]);
                                setCloseConfirmed(false);
                                setShowCloseDialog(true);
                                return;
                            }
                            onUpdate({ status: nextStatus });
                        }
                        }
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
                                            // future: store metadata too
                                            // closedFiles: closeFiles,
                                            // closedAt: new Date().toISOString(),
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

                {/* Channel */}
                <div className="flex items-center px-2 border-r border-gray-200 flex-shrink-0 transition transform active:scale-95 duration-150" style={{ minWidth: 90, width: 90 }}>
                    <StatusBadge value={client.channel} onChange={v => onUpdate({ channel: v })} options={channelOpts} colorMap={CHANNEL_COLORS} small />
                </div>

                {/* Importance */}
                <div className="flex items-center px-2 border-r border-gray-200 flex-shrink-0 transition transform active:scale-95 duration-150" style={{ minWidth: 80, width: 80 }}>
                    <StatusBadge value={client.importance} onChange={v => onUpdate({ importance: v })} options={importanceOpts} colorMap={IMPORTANCE_COLORS} small />
                </div>

                {/* Company */}
                <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 170, width: 170 }}>
                    <EditableCell value={client.company} onChange={v => onUpdate({ company: v })} placeholder="Company" />
                </div>

                {/* Email */}
                <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 180, width: 180 }}>
                    <EditableCell value={client.email} onChange={v => onUpdate({ email: v })} placeholder="Email" />
                </div>

                {/* Phone */}
                <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 120, width: 120 }}>
                    <EditableCell value={client.phone} onChange={v => onUpdate({ phone: v })} placeholder="Phone" />
                </div>

                {/* Requirements */}
                <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 160, width: 160 }}>
                    <EditableCell value={client.requirements} onChange={v => onUpdate({ requirements: v })} placeholder="Requirements" />
                </div>

                {/* Qty */}
                <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 60, width: 60 }}>
                    <EditableCell value={client.qty} onChange={v => onUpdate({ qty: v })} type="number" />
                </div>

                {/* NBD */}
                <div className="flex items-center px-2 border-r border-gray-200 transition transform active:scale-95 duration-150" style={{ minWidth: 100, width: 100 }}>
                    <input type="date" value={client.followUp} onChange={e => onUpdate({ followUp: e.target.value })}
                        className="text-xs border-none outline-none bg-transparent cursor-pointer w-full" />
                </div>

                {/* Total Price */}
                <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 90, width: 90 }}>
                    <EditableCell value={client.totalPrice} onChange={v => onUpdate({ totalPrice: v })} />
                </div>

                {/* Company Address */}
                <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 115, width: 115 }}>
                    <EditableCell value={client.companyAddress} onChange={v => onUpdate({ companyAddress: v })} />
                </div>

                {/* Billing Address */}
                <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 115, width: 115 }}>
                    <EditableCell value={client.billingAddress} onChange={v => onUpdate({ billingAddress: v })} />
                </div>

                {/* Date Created */}
                <div className="flex items-center px-2 border-r border-gray-200" style={{ minWidth: 120, width: 120 }}>
                    <EditableCell value={client.dateCreated} onChange={v => onUpdate({ dateCreated: v })} />
                </div>


                {/* Delete — always visible */}
                <div className="flex items-center px-2 flex-shrink-0" style={{ minWidth: 36, width: 36 }}>
                    <button
                        onClick={onDelete}
                        title="Delete client"
                        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {client.expanded && (
                <SubitemsTable
                    clientId={client.id}
                    subitems={client.subitems}
                    clientColor={'#7BCBD5'}
                    onUpdateSubitem={onUpdateSubitem}
                    onAddSubitem={onAddSubitem}
                    onDeleteSubitem={onDeleteSubitem}
                />
            )}
        </div>
    );
}
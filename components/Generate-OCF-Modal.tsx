"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Client, Subitem } from "@/app/types";

type AwardedSubitem = Pick<Subitem, "id" | "name" | "qty" | "description" | "status" | "pl" | "sl">;

type UploadRow = {
    subitemId: string;
    subitemName: string;
    qty: string | number;
    remarks: string;
    file: File | null;
    uploadedPath: string | null;
    isUploading: boolean;
    error: string | null;
};

type GenerateOcfModalProps = {
    open: boolean;
    client: Client | null;
    onClose: () => void;
    onCreated?: (result: { ocfId: string; internalUrl: string; clientUrl: string }) => void;


};
function toLeadTimeNumber(value: string | number | null | undefined) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function buildEstimatedDeliveryNotes(subitems: Array<{
    name?: string | null;
    pl?: string | number | null;
    sl?: string | number | null;
}>) {
    return subitems
        .map((item) => {
            const pl = toLeadTimeNumber(item.pl);
            const sl = toLeadTimeNumber(item.sl);

            const lines: string[] = [];

            if (pl !== null) {
                lines.push(`- Estimated Production Lead Time: ${pl + 3} days `);
            }

            if (sl !== null) {
                lines.push(`- Estimated Shipping Lead Time: ${sl + 3} days `);
            }

            if (lines.length === 0) return null;

            return `${item.name || "Item"}\n${lines.join("\n")}`;
        })
        .filter(Boolean)
        .join("\n\n");
}
export function GenerateOcfModal({
    open,
    client,
    onClose,
    onCreated,
}: GenerateOcfModalProps) {
    const [awardedSubitems, setAwardedSubitems] = useState<AwardedSubitem[]>([]);
    const [rows, setRows] = useState<UploadRow[]>([]);
    const [importantNotes, setImportantNotes] = useState("");
    const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState("");
    const [estimatedDeliveryNotes, setEstimatedDeliveryNotes] = useState("");
    const [loadingItems, setLoadingItems] = useState(false);
    const [creating, setCreating] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const clientId = client?.id ?? null;

    useEffect(() => {
        if (!open || !client) return;

        const awarded = (client.subitems ?? []).filter(
            (s) => (s.status ?? "").toLowerCase() === "awarded"
        );

        const mappedAwarded = awarded.map((s) => ({
            id: s.id,
            name: s.name,
            qty: s.qty,
            description: s.description,
            status: s.status,
            pl: s.pl,
            sl: s.sl,
        }));

        setAwardedSubitems(mappedAwarded);

        setRows(
            awarded.map((s) => ({
                subitemId: s.id,
                subitemName: s.name ?? "",
                qty: s.qty ?? "",
                remarks: s.description ?? "",
                file: null,
                uploadedPath: null,
                isUploading: false,
                error: null,
            }))
        );

        setImportantNotes("");
        setEstimatedDeliveryDate("");
        setEstimatedDeliveryNotes(buildEstimatedDeliveryNotes(mappedAwarded));
        setFormError(null);
        setCreating(false);
        setLoadingItems(false);
    }, [open, client]);

    const hasAwarded = awardedSubitems.length > 0;

    const allFilesChosen = useMemo(() => {
        if (!rows.length) return false;
        return rows.every((r) => !!r.file || !!r.uploadedPath);
    }, [rows]);

    function updateRow(subitemId: string, patch: Partial<UploadRow>) {
        setRows((prev) =>
            prev.map((row) => (row.subitemId === subitemId ? { ...row, ...patch } : row))
        );
    }

    async function handleUploadRow(subitemId: string) {
        const row = rows.find((r) => r.subitemId === subitemId);
        if (!row || !row.file || !clientId) return;

        updateRow(subitemId, { isUploading: true, error: null });

        try {
            const fd = new FormData();
            fd.append("file", row.file);
            fd.append("clientId", clientId);
            fd.append("subitemId", subitemId);

            const res = await fetch("/api/order-confirmations/upload-item-image", {
                method: "POST",
                body: fd,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Upload failed");
            }

            updateRow(subitemId, {
                uploadedPath: data.path,
                isUploading: false,
            });
        } catch (err: any) {
            updateRow(subitemId, {
                isUploading: false,
                error: err?.message || "Upload failed",
            });
        }
    }

    async function handleUploadAll() {
        for (const row of rows) {
            if (row.file && !row.uploadedPath) {
                await handleUploadRow(row.subitemId);
            }
        }
    }

    async function handleCreate() {
        if (!clientId) return;

        setFormError(null);

        if (!hasAwarded) {
            setFormError("This client has no awarded subitems.");
            return;
        }

        if (!allFilesChosen) {
            setFormError("Please choose an image for every awarded subitem.");
            return;
        }

        const notUploaded = rows.filter((r) => !r.uploadedPath);
        if (notUploaded.length > 0) {
            setFormError("Please upload all selected files before generating the OCF.");
            return;
        }

        setCreating(true);

        try {
            const payload = {
                clientId,
                estimatedDeliveryDate: estimatedDeliveryDate || null,
                importantNotes: importantNotes || "",
                estimatedDeliveryNotes: estimatedDeliveryNotes || "",
                itemUploads: rows.map((row) => ({
                    subitemId: row.subitemId,
                    imagePath: row.uploadedPath,
                })),
            };

            const res = await fetch("/api/order-confirmations/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to generate OCF");
            }

            onCreated?.({
                ocfId: data.ocfId,
                internalUrl: data.internalUrl,
                clientUrl: data.clientUrl,
            });

            onClose();
        } catch (err: any) {
            setFormError(err?.message || "Failed to generate OCF");
        } finally {
            setCreating(false);
        }
    }

    if (!open || !client) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900">Generate Order Confirmation Form</h2>
                        <p className="text-xs text-gray-500">
                            {client.name} {client.company ? `• ${client.company}` : ""}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
                    {!hasAwarded ? (
                        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
                            No awarded subitems found for this client.
                        </div>
                    ) : (
                        <>
                            <div className="mb-5 grid grid-cols-1 gap-1 md:grid-cols-1">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                        Important notes
                                    </label>
                                    <textarea
                                        value={importantNotes}
                                        onChange={(e) => setImportantNotes(e.target.value)}
                                        rows={4}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#7BCBD5]"
                                        placeholder="Terms and conditions"
                                    />
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                        Estimated delivery date:
                                    </label>
                                    <textarea
                                        value={estimatedDeliveryNotes}
                                        onChange={(e) => setEstimatedDeliveryNotes(e.target.value)}
                                        rows={7}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#7BCBD5]"
                                        placeholder="E.g. Production lead time: 2 days"
                                    />
                                </div>

                            </div>

                            <div className="space-y-3">
                                {rows.map((row) => (
                                    <div
                                        key={row.subitemId}
                                        className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                                    >
                                        <div className="mb-2 flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{row.subitemName}</p>
                                                <p className="text-xs text-gray-500">Qty: {row.qty || "-"}</p>
                                                <p className="mt-1 text-xs text-gray-600">
                                                    Remarks: {row.remarks || "-"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                onChange={(e) =>
                                                    updateRow(row.subitemId, {
                                                        file: e.target.files?.[0] ?? null,
                                                        uploadedPath: null,
                                                        error: null,
                                                    })
                                                }
                                                className="block text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[#7BCBD5] file:px-3 file:py-2 file:font-medium file:text-white hover:file:bg-[#6cbac4]"
                                            />

                                            <button
                                                type="button"
                                                onClick={() => handleUploadRow(row.subitemId)}
                                                disabled={!row.file || row.isUploading}
                                                className="rounded-md bg-[#0D1821] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {row.isUploading ? "Uploading..." : "Upload image"}
                                            </button>

                                            {row.uploadedPath && (
                                                <span className="text-xs font-medium text-teal-600">Uploaded</span>
                                            )}
                                        </div>

                                        {row.error && (
                                            <p className="mt-2 text-xs text-red-600">{row.error}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {formError && (
                        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                            {formError}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-gray-200 px-5 py-4">
                    <button
                        type="button"
                        onClick={handleUploadAll}
                        disabled={!hasAwarded}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
                    >
                        Upload all selected
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={!hasAwarded || creating}
                            className="rounded-md bg-[#7BCBD5] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                            {creating ? "Generating..." : "Generate OCF"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type OcfConfigurationSettingsModalProps = {
    open: boolean;
    onClose: () => void;
    currentUserRole: string | null;
};

export default function OcfConfigurationSettingsModal({
    open,
    onClose,
    currentUserRole,
}: OcfConfigurationSettingsModalProps) {
    const [importantNotes, setImportantNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const canEdit = currentUserRole === "director" || "dev";

    useEffect(() => {
        if (!open) return;

        async function loadSettings() {
            setLoading(true);
            setError(null);
            setMessage(null);

            try {
                const res = await fetch("/api/settings/ocf-important-notes", {
                    method: "GET",
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Failed to load OCF settings.");
                }

                setImportantNotes(data.importantNotes ?? "");
            } catch (err: any) {
                setError(err.message || "Failed to load OCF settings.");
            } finally {
                setLoading(false);
            }
        }

        loadSettings();
    }, [open]);

    async function handleSave() {
        if (!canEdit) return;

        setSaving(true);
        setError(null);
        setMessage(null);

        try {
            const res = await fetch("/api/settings/ocf-important-notes", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    importantNotes,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to save OCF settings.");
            }

            setMessage("Important notes saved successfully.");
        } catch (err: any) {
            setError(err.message || "Failed to save OCF settings.");
        } finally {
            setSaving(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900">
                            OCF Configuration Settings
                        </h2>
                        <p className="text-xs text-gray-500">
                            Edit the default Important Notes section shown on generated OCFs.
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

                <div className="px-5 py-4">
                    {loading ? (
                        <p className="text-sm text-gray-500">Loading...</p>
                    ) : (
                        <>
                            <label className="mb-2 block text-xs font-medium text-gray-700">
                                Important Notes
                            </label>
                            <textarea
                                value={importantNotes}
                                onChange={(e) => setImportantNotes(e.target.value)}
                                rows={16}
                                disabled={!canEdit}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#7BCBD5] disabled:bg-gray-100 disabled:text-gray-500"
                                placeholder="Default OCF important notes"
                            />

                            {!canEdit ? (
                                <p className="mt-2 text-xs text-gray-500">
                                    Only directors can edit this setting.
                                </p>
                            ) : null}

                            {error ? (
                                <p className="mt-3 text-sm text-red-600">{error}</p>
                            ) : null}

                            {message ? (
                                <p className="mt-3 text-sm text-green-600">{message}</p>
                            ) : null}
                        </>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700"
                    >
                        Close
                    </button>

                    {canEdit ? (
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="rounded-md bg-[#7BCBD5] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                            {saving ? "Saving..." : "Save"}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
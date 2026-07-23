import { useState } from "react";
type OcfConfigurationSettingsProps = {
    currentUserRole: string | null;
    initialImportantNotes: string;
};

export default function OcfConfigurationSettings({
    currentUserRole,
    initialImportantNotes,
}: OcfConfigurationSettingsProps) {
    const [importantNotes, setImportantNotes] = useState(initialImportantNotes);
    const [saving, setSaving] = useState(false);
    const canEdit = currentUserRole === "director";

    async function handleSave() {
        if (!canEdit) return;

        setSaving(true);
        try {
            const res = await fetch("/api/settings/ocf-important-notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ importantNotes }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save settings.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">OCF Configuration Settings</h2>
            <p className="mt-1 text-xs text-gray-500">
                Default Important Notes shown on generated OCFs.
            </p>

            <div className="mt-4">
                <label className="mb-2 block text-xs font-medium text-gray-700">
                    Important Notes
                </label>
                <textarea
                    value={importantNotes}
                    onChange={(e) => setImportantNotes(e.target.value)}
                    rows={14}
                    disabled={!canEdit}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#7BCBD5] disabled:bg-gray-100 disabled:text-gray-500"
                />
                {!canEdit ? (
                    <p className="mt-2 text-xs text-gray-500">
                        Only directors can edit this setting.
                    </p>
                ) : null}
            </div>

            {canEdit ? (
                <div className="mt-4">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-md bg-[#7BCBD5] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
"use client";

export type ShipmentHistory = {
  id: string;
  cn_tracking_no?: string | null;
  date_of_submission?: string | null;
  shippers?: { name?: string | null } | null;
};
export type ShipmentChoicePreview = {
  rows: Array<{ subitemId: string; name: string }>;
  amendShipmentIdBySubitemId?: Record<string, string>;
};

export function PreviousShipmentChoicesDialog({
  preview,
  history,
  onChange,
  onCancel,
  onContinue,
}: {
  preview: ShipmentChoicePreview;
  history: Record<string, ShipmentHistory[]>;
  onChange: (next: ShipmentChoicePreview) => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const rows = preview.rows.filter(
    (row) => (history[row.subitemId] ?? []).length,
  );
  return (
    <div className="fixed inset-0 z-[175] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        <header className="border-b px-5 py-4">
          <h2 className="font-semibold">Previous shipment choices</h2>
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Previously pushed subitems</strong>
            <br />
            Every subitem listed below has already been pushed. Select a
            specific past shipment to amend, or create a separate new shipment.
          </div>
        </header>
        <main className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
          {rows.map((row) => (
            <label
              key={row.subitemId}
              className="block text-sm font-medium text-slate-700"
            >
              {row.name}
              <select
                value={
                  preview.amendShipmentIdBySubitemId?.[row.subitemId] ?? ""
                }
                onChange={(e) => {
                  const next = {
                    ...(preview.amendShipmentIdBySubitemId ?? {}),
                  };
                  if (e.target.value) next[row.subitemId] = e.target.value;
                  else delete next[row.subitemId];
                  onChange({ ...preview, amendShipmentIdBySubitemId: next });
                }}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Create a separate new shipment</option>
                {(history[row.subitemId] ?? []).map((shipment) => (
                  <option key={shipment.id} value={shipment.id}>
                    Amend: {shipment.shippers?.name ?? "Shipper"} ·{" "}
                    {shipment.cn_tracking_no || "No tracking"} ·{" "}
                    {shipment.date_of_submission || "No date"}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </main>
        <footer className="flex justify-end gap-2 border-t px-5 py-4">
          <button
            onClick={onCancel}
            className="rounded border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="rounded bg-teal-600 px-4 py-2 text-sm text-white"
          >
            Continue to preview
          </button>
        </footer>
      </div>
    </div>
  );
}

"use client";

import { X } from "lucide-react";

type CombinedPushPreview = {
  rows: Array<
    Record<string, any> & {
      subitemId: string;
      name: string;
      alreadyPushed: boolean;
    }
  >;
  shipperName: string;
  page: number;
  shared: Record<string, string>;
  existingMode: "separate" | "repush";
  amendShipmentIdBySubitemId?: Record<string, string>;
};

function CombinedShipmentInfo({
  preview,
  onChange,
}: {
  preview: CombinedPushPreview;
  onChange: (next: CombinedPushPreview) => void;
}) {
  const total = preview.rows.reduce(
    (sum, row) => sum + (Number(row.qty) || 0) * (Number(row.up) || 0),
    0,
  );
  const set = (key: string, value: string) =>
    onChange({ ...preview, shared: { ...preview.shared, [key]: value } });
  return (
    <section className="mt-5 border-t pt-4">
      <h3 className="font-semibold">Combined shipment information</h3>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <label className="text-xs">
          Date of Submission *
          <input
            type="date"
            value={preview.shared.info_provided_date}
            onChange={(e) => set("info_provided_date", e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <div className="text-xs">
          Total Value
          <div className="mt-1 rounded bg-slate-100 px-3 py-2">
            {total.toFixed(2)}
          </div>
        </div>
        <label className="text-xs">
          ???
          <select
            value={preview.shared.tax_refund ?? ""}
            onChange={(e) => set("tax_refund", e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            <option value="?">?</option>
            <option value="X">X</option>
          </select>
        </label>
        <label className="text-xs">
          Air/Sea? *
          <select
            value={preview.shared.sea_or_air}
            onChange={(e) => set("sea_or_air", e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            <option value="" />
            <option value="??">??</option>
            <option value="??">??</option>
            <option value="??/??">??/??</option>
          </select>
        </label>
        <label className="text-xs md:col-span-2">
          Address *
          <textarea
            value={preview.shared.delivery_info}
            onChange={(e) => set("delivery_info", e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
      </div>
    </section>
  );
}
export function CombinedPushPreviewModal({
  preview,
  saving,
  onChange,
  onClose,
  onConfirm,
}: {
  preview: CombinedPushPreview;
  saving: boolean;
  onChange: (next: CombinedPushPreview) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const item = preview.rows[preview.page];
  const changeItem = (key: string, value: string) =>
    onChange({
      ...preview,
      rows: preview.rows.map((row, index) =>
        index === preview.page ? { ...row, [key]: value } : row,
      ),
    });
  const required = (key: string) => !String(item[key] ?? "").trim();
  const complete =
    preview.rows.every((row) =>
      ["cn_tracking_no", "qty", "up", "samples_by_air", "samples_by_sea"].every(
        (key) => String(row[key] ?? "").trim(),
      ),
    ) &&
    ["info_provided_date", "delivery_info", "sea_or_air", "tax_refund"].every(
      (key) => String(preview.shared[key] ?? "").trim(),
    );
  const field = (
    label: string,
    key: string,
    type = "text",
    mandatory = true,
  ) => (
    <label className="block text-xs font-medium text-slate-700">
      {label}
      {mandatory && <span className="text-red-500"> *</span>}
      <input
        type={type}
        value={item[key] ?? ""}
        onChange={(e) => changeItem(key, e.target.value)}
        className={`mt-1 w-full rounded border px-3 py-2 text-sm ${mandatory && required(key) ? "border-red-300 bg-red-50" : "border-slate-300"}`}
      />
    </label>
  );
  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Pushing to {preview.shipperName}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Subitem {preview.page + 1} of {preview.rows.length}: {item.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-5">
          {item.alreadyPushed && (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              This subitem was pushed before. Its selected previous-shipment
              choice is applied when you confirm.
            </div>
          )}
          <label className="block text-xs font-medium text-slate-700">
            CN Tracking # *
            <input
              value={item.cn_tracking_no ?? ""}
              onChange={(e) => changeItem("cn_tracking_no", e.target.value)}
              className={`mt-1 w-full rounded border px-3 py-2 text-sm ${required("cn_tracking_no") ? "border-red-300 bg-red-50" : "border-slate-300"}`}
            />
          </label>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <div className="space-y-4 border-r border-slate-200 pr-5">
              {field("Qty", "qty", "number")}
              {field("Unit Price", "up", "number")}
              <div className="text-xs font-medium text-slate-700">
                Value
                <div className="mt-1 rounded bg-slate-100 px-3 py-2 text-sm">
                  {((Number(item.qty) || 0) * (Number(item.up) || 0)).toFixed(
                    2,
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {field("Samples by Air", "samples_by_air")}
              {field("Samples by Sea", "samples_by_sea")}
              <label className="block text-xs font-medium text-slate-700">
                Remarks
                <textarea
                  value={item.shipper_remarks ?? ""}
                  onChange={(e) =>
                    changeItem("shipper_remarks", e.target.value)
                  }
                  rows={3}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
          <nav className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-200 pt-4">
            <button
              disabled={preview.page === 0}
              onClick={() => onChange({ ...preview, page: preview.page - 1 })}
              className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="self-center text-center text-sm">
              Page {preview.page + 1}
            </span>
            <button
              disabled={preview.page === preview.rows.length - 1}
              onClick={() => onChange({ ...preview, page: preview.page + 1 })}
              className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </nav>
          <CombinedShipmentInfo preview={preview} onChange={onChange} />
        </main>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded border border-slate-300 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            disabled={saving || !complete}
            onClick={onConfirm}
            className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Pushing..." : "Confirm & push"}
          </button>
        </footer>
      </div>
    </div>
  );
}

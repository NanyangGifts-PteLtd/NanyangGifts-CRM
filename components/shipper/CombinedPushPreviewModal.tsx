"use client";

import { useMemo, useRef } from "react";
import { X } from "lucide-react";
import { useEscapeClose } from "../hooks/use-escape-close";

type CombinedPushPreview = {
  rows: Array<
    Record<string, any> & {
      subitemId: string;
      name: string;
      alreadyPushed: boolean;
      trackingOptions?: string[];
      timelineOptions?: Array<{
        id: string;
        label: string;
        cnTracking?: string;
        cartons?: string;
        shipper?: string;
      }>;
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
    <section className="mt-5 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-900">
        Combined shipment information
      </h3>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <label className="text-xs font-medium text-slate-700">
          Date of Submission *
          <input
            type="date"
            value={preview.shared.info_provided_date}
            onChange={(e) => set("info_provided_date", e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <div className="text-xs font-medium text-slate-700">
          Total Value
          <div className="mt-1 rounded bg-slate-100 px-3 py-2 text-sm font-normal text-slate-900">
            {total.toFixed(2)}
          </div>
        </div>
        <label className="text-xs font-medium text-slate-700">
          退税?
          <select
            value={preview.shared.tax_refund ?? ""}
            onChange={(e) => set("tax_refund", e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
          >
            <option value="退">退</option>
            <option value="X">X</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          Air/Sea? *
          <select
            value={preview.shared.sea_or_air}
            onChange={(e) => set("sea_or_air", e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
          >
            <option value="" />
            <option value="空运">空运</option>
            <option value="海运">海运</option>
            <option value="海运/小包">海运/小包</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700 md:col-span-2">
          Address *
          <textarea
            value={preview.shared.delivery_info}
            onChange={(e) => set("delivery_info", e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
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
  const initialPreview = useRef(
    JSON.stringify({ rows: preview.rows, shared: preview.shared }),
  );
  const isDirty = useMemo(
    () =>
      JSON.stringify({ rows: preview.rows, shared: preview.shared }) !==
      initialPreview.current,
    [preview.rows, preview.shared],
  );
  useEscapeClose({ open: true, onClose, disabled: saving, isDirty });
  const item = preview.rows[preview.page];
  const shipperForRow = (row: (typeof preview.rows)[number]) => {
    const timeline = row.timelineOptions?.find(
      (candidate) =>
        candidate.id === row.timeline_id ||
        candidate.cnTracking === row.cn_tracking_no,
    );
    return String(timeline?.shipper ?? "").trim();
  };
  const selectedShipperNames = new Set(
    preview.rows.map(shipperForRow).filter(Boolean),
  );
  const selectedShipper = shipperForRow(item);
  const hasMixedShippers = selectedShipperNames.size > 1;
  const changeItemFields = (changes: Record<string, string>) =>
    onChange({
      ...preview,
      rows: preview.rows.map((row, index) =>
        index === preview.page ? { ...row, ...changes } : row,
      ),
    });
  const changeItem = (key: string, value: string) =>
    changeItemFields({ [key]: value });
  const required = (key: string) => !String(item[key] ?? "").trim();
  const complete =
    preview.rows.every((row) =>
      ["cn_tracking_no", "qty", "up", "samples_by_air", "samples_by_sea"].every(
        (key) => String(row[key] ?? "").trim(),
      ),
    ) &&
    preview.rows.every(
      (row) =>
        (row.trackingOptions?.length ?? 0) > 0 || Boolean(row.timeline_id),
    ) &&
    ["info_provided_date", "delivery_info", "sea_or_air", "tax_refund"].every(
      (key) => String(preview.shared[key] ?? "").trim(),
    ) &&
    !hasMixedShippers;
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
      className="fixed inset-0 z-modal flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {selectedShipper
                ? `Sending to ${selectedShipper}`
                : "Send to shipper"}
            </h2>
            <p className="mt-1 text-lg font-medium text-slate-700">
              {item.name}
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
          {hasMixedShippers && (
            <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              The selected timelines use different shippers. Multi-send can
              only be sent when every selected timeline has the same shipper.
            </div>
          )}
          {item.alreadyPushed && (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Previously sent to{" "}
              {item.previousShipperName || "an unknown shipper"}.
            </div>
          )}
          <label className="block text-xs font-medium text-slate-700">
            CN Tracking # *
            {(item.trackingOptions?.length ?? 0) > 0 ? (
              <select
                value={item.cn_tracking_no ?? ""}
                onChange={(e) => {
                  const cnTrackingNo = e.target.value;
                  const timeline = item.timelineOptions?.find(
                    (candidate) => candidate.cnTracking === cnTrackingNo,
                  );
                  changeItemFields({
                    cn_tracking_no: cnTrackingNo,
                    ...(timeline
                      ? {
                          timeline_id: timeline.id,
                          cartons: timeline.cartons ?? "",
                        }
                      : {}),
                  });
                }}
                className={`mt-1 w-full rounded border px-3 py-2 text-sm ${required("cn_tracking_no") ? "border-red-300 bg-red-50" : "border-slate-300"}`}
              >
                <option value="">
                  Select a project timeline CN Tracking number
                </option>
                {(item.trackingOptions ?? []).map((trackingNumber: string) => (
                  <option key={trackingNumber} value={trackingNumber}>
                    {trackingNumber}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  value={item.cn_tracking_no ?? ""}
                  onChange={(e) => changeItem("cn_tracking_no", e.target.value)}
                  placeholder="Enter the first CN Tracking number"
                  className={`mt-1 w-full rounded border px-3 py-2 text-sm ${required("cn_tracking_no") ? "border-red-300 bg-red-50" : "border-slate-300"}`}
                />
                <select
                  value={item.timeline_id ?? ""}
                  onChange={(e) => {
                    const timelineId = e.target.value;
                    const timeline = item.timelineOptions?.find(
                      (candidate) => candidate.id === timelineId,
                    );
                    changeItemFields({
                      timeline_id: timelineId,
                      ...(timeline ? { cartons: timeline.cartons ?? "" } : {}),
                    });
                  }}
                  className={`mt-2 w-full rounded border px-3 py-2 text-sm ${item.timeline_id ? "border-slate-300" : "border-red-300 bg-red-50"}`}
                >
                  <option value="">Select the Project Timeline</option>
                  {(item.timelineOptions ?? []).map((timeline) => (
                    <option key={timeline.id} value={timeline.id}>
                      {timeline.label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </label>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <div className="space-y-4 border-r border-slate-200 pr-5">
              {field("Cartons", "cartons", "number", false)}
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
              {field("Item display name", "item_name", "text")}
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
          <nav className="-mx-5 mt-5 grid grid-cols-3 gap-3 border-y border-teal-500 bg-teal-200 px-5 py-3 shadow-sm">
            <button
              disabled={preview.page === 0}
              onClick={() => onChange({ ...preview, page: preview.page - 1 })}
              className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="self-center text-center text-sm font-semibold text-teal-950">
              Item {preview.page + 1}
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
            {saving ? "Sending..." : "Confirm & send"}
          </button>
        </footer>
      </div>
    </div>
  );
}

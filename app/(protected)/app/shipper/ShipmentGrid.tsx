"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, PaintBucket, Trash2, X } from "lucide-react";

type CellFills = Record<string, string>;

type ShipmentItem = {
  id: string;
  display_name: string;
  quantity: number | null;
  unit_price: number | null;
  declared_value: number | null;
  remarks: string | null;
  cn_tracking_no?: string | null;
  cartons?: number | null;
  samples_by_air?: string | null;
  samples_by_sea?: string | null;
  air_received?: string | null;
  sea_received?: string | null;
  cell_fills?: CellFills | null;
};

export type ShipmentRecord = {
  id: string;
  shipper_id: string | null;
  ic: string | null;
  date_of_submission: string | null;
  cn_tracking_no: string | null;
  delivery_info: string | null;
  sea_or_air: string | null;
  tax_refund: string | null;
  cartons: number | null;
  serial_number: string | null;
  waybill_date: string | null;
  waybill_number: string | null;
  pieces: number | null;
  chargeable_weight_kg: number | null;
  destination: string | null;
  freight_unit_price: number | null;
  freight_cost: number | null;
  gst: number | null;
  other_fees: number | null;
  total_cost: number | null;
  channel: string | null;
  is_locked?: boolean;
  logistics_remarks?: string | null;
  cell_fills?: CellFills | null;
  items: ShipmentItem[];
};

type ShipmentGridProps = {
  shipments: ShipmentRecord[];
  mode?: "pm" | "shipper";
};

const shipperEditableFields = new Set([
  "serial_number",
  "waybill_date",
  "waybill_number",
  "pieces",
  "chargeable_weight_kg",
  "destination",
  "freight_unit_price",
  "gst",
  "other_fees",
  "channel",
  "logistics_remarks",
]);

type Column = {
  key: string;
  label: string;
  scope: "shipment" | "item";
  input?: "date" | "number" | "select-air" | "select-tax" | "textarea";
  calculated?: boolean;
  width?: number;
};

const columns: Column[] = [
  { key: "serial_number", label: "序号", scope: "shipment" },
  { key: "waybill_date", label: "运单日期", scope: "shipment", input: "date" },
  { key: "waybill_number", label: "运单号码", scope: "shipment" },
  { key: "pieces", label: "件数", scope: "shipment", input: "number" },
  {
    key: "chargeable_weight_kg",
    label: "计费重量 (KG)",
    scope: "shipment",
    input: "number",
  },
  { key: "destination", label: "目的地", scope: "shipment" },
  {
    key: "freight_unit_price",
    label: "单价",
    scope: "shipment",
    input: "number",
    width: 130,
  },
  { key: "freight_cost", label: "运费", scope: "shipment", calculated: true },
  { key: "gst", label: "消费税", scope: "shipment", input: "number" },
  { key: "other_fees", label: "其他费用", scope: "shipment", input: "number" },
  { key: "total_cost", label: "总计费用", scope: "shipment", calculated: true },
  {
    key: "channel",
    label: "渠道",
    scope: "shipment",
    input: "select-air",
  },
  {
    key: "logistics_remarks",
    label: "备注",
    scope: "shipment",
    input: "textarea",
    width: 220,
  },
  { key: "ic", label: "谁下单 / I/C", scope: "shipment" },
  {
    key: "date_of_submission",
    label: "提供资料日期",
    scope: "shipment",
    input: "date",
  },
  { key: "cn_tracking_no", label: "单号 / CN Tracking #", scope: "item" },
  { key: "cartons", label: "箱子 / Cartons", scope: "item", input: "number" },
  { key: "display_name", label: "货名 / Item name", scope: "item" },
  {
    key: "delivery_info",
    label: "地址 / Address",
    scope: "shipment",
    input: "textarea",
    width: 280,
  },
  { key: "quantity", label: "数量 / Qty", scope: "item", input: "number" },
  {
    key: "unit_price",
    label: "单价 / Unit Price",
    scope: "item",
    input: "number",
    width: 150,
  },
  {
    key: "declared_value",
    label: "货值 / Value",
    scope: "item",
    calculated: true,
  },
  {
    key: "sea_or_air",
    label: "海运、空运 / Sea or Air?",
    scope: "shipment",
    input: "select-air",
  },
  { key: "tax_refund", label: "退税?", scope: "shipment", input: "select-tax" },
  {
    key: "remarks",
    label: "备注 / Remarks",
    scope: "item",
    input: "textarea",
    width: 220,
  },
  {
    key: "samples_by_air",
    label: "发样品空运 / Samples by air",
    scope: "item",
  },
  {
    key: "samples_by_sea",
    label: "发样品海运 / Samples by sea",
    scope: "item",
  },
  { key: "air_received", label: "空运收到 / Air received", scope: "item" },
  { key: "sea_received", label: "海运收到 / Sea received", scope: "item" },
];

const fillColors = [
  "#ffffff",
  "#f3f4f6",
  "#d1d5db",
  "#9ca3af",
  "#6b7280",
  "#374151",
  "#fff200",
  "#fde68a",
  "#fed7aa",
  "#fdba74",
  "#fb923c",
  "#f97316",
  "#fecdd3",
  "#fda4af",
  "#fb7185",
  "#f43f5e",
  "#e11d48",
  "#be123c",
  "#e9d5ff",
  "#ddd6fe",
  "#c4b5fd",
  "#a78bfa",
  "#8b5cf6",
  "#7c3aed",
  "#bae6fd",
  "#7dd3fc",
  "#38bdf8",
  "#0ea5e9",
  "#0284c7",
  "#0369a1",
  "#bbf7d0",
  "#86efac",
  "#4ade80",
  "#22c55e",
  "#16a34a",
  "#15803d",
  "#ccfbf1",
];

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function emptyItem(shipmentId: string): ShipmentItem {
  return {
    id: `${shipmentId}-empty`,
    display_name: "",
    quantity: null,
    unit_price: null,
    declared_value: null,
    remarks: null,
  };
}

function EditableCell({
  value,
  column,
  onSave,
}: {
  value: unknown;
  column: Column;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(text(value));
  const [editingDate, setEditingDate] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setDraft(text(value)), [value]);
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.max(56, textareaRef.current.scrollHeight)}px`;
  }, [draft]);

  if (column.calculated) {
    return (
      <div className="flex min-h-[42px] items-center justify-center px-2">
        {text(value)}
      </div>
    );
  }

  if (column.input === "select-air") {
    return (
      <select
        value={draft}
        onChange={(event) => onSave(event.target.value)}
        className="min-h-[42px] w-full border-0 bg-transparent px-2 text-center outline-none focus:bg-blue-50"
      >
        <option value="" />
        <option value="空运">空运</option>
        <option value="海运">海运</option>
        <option value="海运/小包">海运/小包</option>
      </select>
    );
  }

  if (column.input === "select-tax") {
    return (
      <select
        value={draft}
        onChange={(event) => onSave(event.target.value)}
        className="min-h-[42px] w-full border-0 bg-transparent px-2 text-center outline-none focus:bg-blue-50"
      >
        <option value="" />
        <option value="退">退</option>
        <option value="X">X</option>
      </select>
    );
  }

  if (!column.input || column.input === "textarea") {
    return (
      <textarea
        ref={textareaRef}
        spellCheck={false}
        value={draft}
        rows={1}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onSave(draft)}
        className="block min-h-[56px] w-full resize-none overflow-hidden border-0 bg-transparent px-3 py-2 text-center whitespace-pre-wrap break-words outline-none focus:bg-blue-50"
      />
    );
  }

  if (column.input === "date" && !editingDate) {
    return (
      <button
        type="button"
        onClick={() => setEditingDate(true)}
        className="min-h-[56px] w-full px-3 text-center outline-none hover:bg-blue-50"
      >
        {draft
          ? new Intl.DateTimeFormat("en-GB").format(
              new Date(`${draft}T00:00:00`),
            )
          : ""}
      </button>
    );
  }

  return (
    <input
      autoFocus
      spellCheck={false}
      type={column.input === "date" ? "date" : "number"}
      step={column.input === "number" ? "any" : undefined}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        onSave(draft);
        setEditingDate(false);
      }}
      className="min-h-[56px] w-full border-0 bg-transparent px-3 text-center outline-none focus:bg-blue-50"
    />
  );
}

function ShipmentRemarkCell({
  value,
  shipmentId,
  shipperId,
  itemId,
  onSave,
}: {
  value: unknown;
  shipmentId: string;
  shipperId: string | null;
  itemId?: string;
  onSave: (value: string) => void;
}) {
  const attachmentSource = (reference: string) => {
    if (reference.startsWith("/api/shipper/image?path=")) return reference;
    const publicMarker = "/storage/v1/object/public/shipper-attachments/";
    const markerIndex = reference.indexOf(publicMarker);
    if (markerIndex === -1) return reference;
    const path = reference.slice(markerIndex + publicMarker.length);
    return `/api/shipper/image?path=${encodeURIComponent(path)}`;
  };
  const [draft, setDraft] = useState(text(value));
  const [uploading, setUploading] = useState(false);
  useEffect(() => setDraft(text(value)), [value]);
  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (shipperId) form.append("shipperId", shipperId);
      if (itemId) form.append("shipmentItemId", itemId);
      else form.append("shipmentId", shipmentId);
      const response = await fetch("/api/shipper/upload-image", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Image upload failed");
      const next = `${draft}${draft.trim() ? "\n\n" : ""}[[shipper-image:${result.url}]]`;
      setDraft(next);
      onSave(next);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Image upload failed",
      );
    } finally {
      setUploading(false);
    }
  };
  const urls = [...draft.matchAll(/\[\[shipper-image:([^\]]+)\]\]/g)].map(
    (match) => match[1],
  );
  const plainText = draft
    .replace(/\[\[shipper-image:[^\]]+\]\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const setPlainText = (nextText: string) =>
    setDraft(
      `${nextText.trim()}${nextText.trim() && urls.length ? "\n\n" : ""}${urls.map((url) => `[[shipper-image:${url}]]`).join("\n")}`,
    );
  const remove = async (url: string) => {
    setUploading(true);
    try {
      const response = await fetch("/api/shipper/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not remove image");
      const next = draft
        .replace(`[[shipper-image:${url}]]`, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      setDraft(next);
      onSave(next);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not remove image",
      );
    } finally {
      setUploading(false);
    }
  };
  return (
    <div
      className="min-h-[56px]"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = Array.from(event.dataTransfer.files).find((candidate) =>
          candidate.type.startsWith("image/"),
        );
        if (file) void upload(file);
      }}
    >
      <textarea
        spellCheck={false}
        value={plainText}
        rows={2}
        onChange={(event) => setPlainText(event.target.value)}
        onBlur={() => onSave(draft)}
        className="block min-h-[56px] w-full resize-y border-0 bg-transparent px-3 py-2 text-center outline-none focus:bg-blue-50"
      />
      {urls.map((url) => (
        <div key={url} className="relative mx-auto mb-2 w-fit">
          <a href={attachmentSource(url)} target="_blank" rel="noreferrer">
            <img
              src={attachmentSource(url)}
              alt="Remark attachment"
              className="max-h-32 max-w-[180px] rounded border"
            />
          </a>
          <button
            type="button"
            disabled={uploading}
            onClick={() => void remove(url)}
            className="absolute right-1 top-1 rounded bg-white/90 p-1 text-red-600 shadow"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <label className="flex cursor-pointer items-center justify-center gap-1 pb-2 text-xs text-slate-500">
        <ImagePlus size={13} />
        {uploading ? "Uploading…" : "Drop or attach image"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

export function ShipmentGrid({ shipments, mode = "pm" }: ShipmentGridProps) {
  const [gridShipments, setGridShipments] = useState(shipments);
  const [selectedCells, setSelectedCells] = useState<
    Array<{ id: string; scope: "shipment" | "item"; field: string }>
  >([]);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    setGridShipments((current) => {
      const currentSnapshot = JSON.stringify(current);
      const incomingSnapshot = JSON.stringify(shipments);
      return currentSnapshot === incomingSnapshot ? current : shipments;
    });
  }, [shipments]);

  const saveCell = async (
    shipmentId: string,
    itemId: string | undefined,
    field: string,
    value: string,
  ) => {
    const isShipment = !itemId;
    setGridShipments((current) =>
      current.map((shipment) => {
        if (shipment.id !== shipmentId) return shipment;
        if (isShipment) return { ...shipment, [field]: value };
        return {
          ...shipment,
          items: shipment.items.map((item) =>
            item.id === itemId ? { ...item, [field]: value } : item,
          ),
        };
      }),
    );

    try {
      const response = await fetch("/api/shipper/shipments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isShipment ? { shipmentId, field, value } : { itemId, field, value },
        ),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save cell.");

      setGridShipments((current) =>
        current.map((shipment) => {
          if (shipment.id !== shipmentId) return shipment;
          if (isShipment) return { ...shipment, ...result.values };
          return {
            ...shipment,
            items: shipment.items.map((item) =>
              item.id === itemId ? { ...item, ...result.values } : item,
            ),
          };
        }),
      );
    } catch (error) {
      console.error(error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Could not save shipment cell.",
      );
      setGridShipments(shipments);
    }
  };

  const fillSelectedCell = (color: string) => {
    selectedCells.forEach((selectedCell) => {
      const shipment = gridShipments.find(
        (item) =>
          item.id === selectedCell.id ||
          item.items.some((line) => line.id === selectedCell.id),
      );
      if (!shipment) return;
      const item =
        selectedCell.scope === "item"
          ? shipment.items.find((line) => line.id === selectedCell.id)
          : undefined;
      const fills = { ...(item?.cell_fills ?? shipment.cell_fills ?? {}) };
      if (color) fills[selectedCell.field] = color;
      else delete fills[selectedCell.field];
      void saveCell(shipment.id, item?.id, "cell_fills", JSON.stringify(fills));
    });
    setPaletteOpen(false);
  };
  const toggleLock = (shipment: ShipmentRecord) =>
    void saveCell(
      shipment.id,
      undefined,
      "is_locked",
      shipment.is_locked ? "false" : "true",
    );

  return (
    <div className="w-full">
      <div className="mb-1 flex h-10 max-w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-2 shadow-sm">
        {paletteOpen && selectedCells.length ? (
          <>
            <span className="shrink-0 text-xs font-medium text-slate-500">
              Fill
            </span>
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1">
              {fillColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => fillSelectedCell(color)}
                  className="h-5 w-5 shrink-0 rounded border border-slate-300"
                  style={{ backgroundColor: color }}
                  title="Fill selected cell"
                />
              ))}
              <button
                type="button"
                onClick={() => fillSelectedCell("")}
                className="shrink-0 rounded border border-slate-300 px-2 text-[10px] text-slate-600"
              >
                Clear
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPaletteOpen(false)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!selectedCells.length}
            onClick={() => setPaletteOpen(true)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            <PaintBucket size={15} /> Fill colour
          </button>
        )}
      </div>
      <div className="overflow-auto rounded-md border border-slate-300 bg-white">
        <table className="min-w-[3150px] border-separate border-spacing-0 text-[13px] text-slate-900">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 w-12 border-b-2 border-r border-slate-400 bg-slate-100">
                🔒
              </th>
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  style={
                    column.width
                      ? { minWidth: column.width, width: column.width }
                      : undefined
                  }
                  className={`sticky top-0 z-20 border-b-2 border-r border-slate-400 px-3 py-2 text-center font-medium whitespace-nowrap ${index < 13 ? "bg-white" : "bg-[#4588ed] text-white"}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gridShipments.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="p-8 text-center text-slate-500"
                >
                  No shipments yet.
                </td>
              </tr>
            ) : (
              gridShipments.flatMap((shipment) => {
                const items = shipment.items.length
                  ? shipment.items
                  : [emptyItem(shipment.id)];
                return items.map((item, itemIndex) => (
                  <tr
                    key={`${shipment.id}-${item.id}`}
                    className="hover:bg-slate-50"
                  >
                    {itemIndex === 0 && (
                      <td
                        rowSpan={items.length}
                        className="sticky left-0 z-10 border-b border-r bg-white text-center"
                      >
                        <button
                          onClick={() => toggleLock(shipment)}
                          className="p-2"
                          title={
                            shipment.is_locked
                              ? "Unlock shipment"
                              : "Lock shipment"
                          }
                        >
                          {shipment.is_locked ? "🔒" : "🔓"}
                        </button>
                      </td>
                    )}
                    {columns.map((column) => {
                      const isShared = column.scope === "shipment";
                      if (isShared && itemIndex > 0) return null;
                      const record = isShared ? shipment : item;
                      const value = record[column.key as keyof typeof record];
                      const fill = (record.cell_fills ?? {})[column.key];
                      const targetId = isShared ? shipment.id : item.id;
                      const cell = {
                        id: targetId,
                        scope: column.scope,
                        field: column.key,
                      } as const;
                      const isSelected = selectedCells.some(
                        (selected) =>
                          selected.id === cell.id &&
                          selected.field === cell.field,
                      );
                      const editable =
                        (mode === "pm" ||
                          shipperEditableFields.has(column.key)) &&
                        (!shipment.is_locked ||
                          ["air_received", "sea_received"].includes(
                            column.key,
                          ));
                      const saveValue = (nextValue: string) => {
                        if (nextValue !== text(value))
                          void saveCell(
                            shipment.id,
                            isShared ? undefined : item.id,
                            column.key,
                            nextValue,
                          );
                      };
                      return (
                        <td
                          key={column.key}
                          rowSpan={isShared ? items.length : undefined}
                          style={{
                            ...(column.width
                              ? { minWidth: column.width, width: column.width }
                              : {}),
                            backgroundColor: fill,
                          }}
                          onClick={(event) =>
                            setSelectedCells((current) => {
                              if (!event.ctrlKey && !event.metaKey)
                                return [cell];
                              return isSelected
                                ? current.filter(
                                    (selected) =>
                                      !(
                                        selected.id === cell.id &&
                                        selected.field === cell.field
                                      ),
                                  )
                                : [...current, cell];
                            })
                          }
                          className={`border-b border-r border-slate-300 p-0 text-center align-middle ${column.calculated ? "bg-amber-50 font-medium text-amber-950" : ""} ${isSelected ? "ring-2 ring-inset ring-sky-600" : ""}`}
                        >
                          {editable &&
                            (column.key === "logistics_remarks" ||
                              column.key === "remarks") ? (
                            <ShipmentRemarkCell
                              value={value}
                              shipmentId={shipment.id}
                              shipperId={shipment.shipper_id}
                              itemId={isShared ? undefined : item.id}
                              onSave={saveValue}
                            />
                          ) : editable ? (
                            <EditableCell
                              value={value}
                              column={column}
                              onSave={saveValue}
                            />
                          ) : (
                            <div className="min-h-[56px] px-3 py-2 whitespace-pre-wrap">
                              {text(value)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ));
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
